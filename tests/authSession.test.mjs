import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function evaluate(source, bindings) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, ...bindings };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

function loadModule(path, bindings) {
  return evaluate(readFileSync(new URL(path, import.meta.url), 'utf8'), bindings);
}

const authSource = readFileSync(new URL('../src/components/auth/AuthFlow.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('AuthFlow.tsx', authSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function loadAction(name, bindings) {
  let action;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) action = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(action, `Missing action: ${name}`);
  return evaluate(`exports.action = ${action.getText(ast)};`, bindings).action;
}

function createClient(fetch) {
  const client = loadModule('../src/services/apiClient.ts', {
    require: () => ({ API_BASE_URL: 'https://efact.example.test' }),
    __DEV__: false, AbortController, FormData, setTimeout, clearTimeout, fetch,
  });
  const service = loadModule('../src/services/authService.ts', { require: () => client });
  return { ...client, ...service };
}

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const credentials = { username: 'usuario.prueba', password: 'clave-prueba', recordarme: false };

for (const status of [400, 401, 403, 409, 423]) {
  test(`Conserva el conflicto de sesión al iniciar sesión con HTTP ${status}`, async () => {
    const client = createClient(async () => json({ mensaje: 'Ya tienes una sesión activa en otro dispositivo.' }, status));
    await assert.rejects(client.login(credentials), error => {
      assert.equal(error.status, status);
      assert.match(error.message, /sesión activa/);
      assert.equal(client.isSessionConflictError(error), true);
      return true;
    });
  });
}

test('Un 409 sin mensaje permite reemplazar la sesión, pero credenciales incorrectas y fallas del servidor no', async () => {
  for (const [status, body, expected] of [
    [409, {}, true],
    [401, { mensaje: 'Contraseña incorrecta' }, false],
    [403, { mensaje: 'Cuenta bloqueada' }, false],
    [500, { mensaje: 'Error al comprobar la sesión activa' }, false],
  ]) {
    const client = createClient(async () => json(body, status));
    await assert.rejects(client.login(credentials), error => {
      assert.equal(client.isSessionConflictError(error), expected);
      if (status === 401) assert.equal(error.message, 'La contraseña es incorrecta.');
      return true;
    });
  }
});

function sessionServer() {
  let activeSession;
  let sequence = 0;
  const requests = [];
  return {
    requests,
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/api/auth/login')) {
        const request = JSON.parse(options.body);
        if (request.password !== credentials.password) return json({ mensaje: 'Contraseña incorrecta' }, 401);
        if (activeSession && !request.forzar) return json({ mensaje: 'Sesión abierta en otro dispositivo' }, 401);
        activeSession = `Auth_Session=session-${++sequence}`;
        return json({ success: true, idUsuario: 7 }, 200, { 'set-cookie': `${activeSession}; Path=/; Secure` });
      }
      if (options.headers.Cookie !== activeSession) return json({ mensaje: 'Sesión iniciada en otro dispositivo' }, 401);
      return json({ authenticated: true, idUsuario: 7 });
    },
  };
}

function loginFlow(client) {
  const applied = [];
  const authenticationStates = [];
  let showAlert;
  const alert = new Promise(resolve => { showAlert = resolve; });
  const authenticate = loadAction('authenticate', {
    login: client.login, isSessionConflictError: client.isSessionConflictError,
    setAuthenticating: value => authenticationStates.push(value),
    applyLoginResponse: async (...args) => applied.push(args),
    Alert: { alert: (...args) => showAlert(args) },
  });
  return { authenticate, alert, applied, authenticationStates };
}

test('Un rechazo dentro de HTTP 200 no se interpreta como sesión iniciada', async () => {
  for (const body of [
    { success: false, message: 'Credenciales inválidas' },
    { success: false, mensaje: 'Credenciales inválidas' },
    { success: false, message: 'System.Exception: información interna' },
  ]) {
    const client = createClient(async () => json(body));
    const flow = loginFlow(client);
    await assert.rejects(flow.authenticate(credentials), error => error.status === 400 && !/System\.Exception/.test(error.message));
    assert.equal(flow.applied.length, 0);
  }
  for (const requirement of ['requierePoliticas', 'requiereCambioClave']) {
    const client = createClient(async () => json({ success: false, [requirement]: true, idUsuario: 7 }));
    assert.equal((await client.login(credentials))[requirement], true);
  }
});

test('El conflicto con HTTP 200 también requiere confirmación y admite cancelar', async () => {
  let requests = 0;
  const client = createClient(async () => {
    requests++;
    return json({ success: false, mensaje: 'Sesión abierta en otro dispositivo' });
  });
  const flow = loginFlow(client);
  const pending = flow.authenticate(credentials);
  const [, , buttons] = await flow.alert;
  assert.equal(requests, 1);
  buttons.find(button => button.style === 'cancel').onPress();
  await pending;
  assert.equal(requests, 1);
  assert.equal(flow.applied.length, 0);
});

test('El acceso con contraseña detecta otra sesión sin biometría y con ambos valores de Recordarme', async () => {
  for (const recordarme of [false, true]) {
    const server = sessionServer();
    const previous = createClient(server.fetch);
    await previous.login({ ...credentials, recordarme });
    const client = createClient(server.fetch);
    const flow = loginFlow(client);
    const submitLogin = loadAction('submitLogin', {
      ...credentials, recordarme, validateLogin: () => ({ valid: true }),
      runRequest: async action => action(), authenticate: flow.authenticate,
    });
    const pending = submitLogin();
    const [title, , buttons] = await flow.alert;
    assert.match(title, /Sesión abierta/);
    assert.equal(flow.applied.length, 0);
    buttons.find(button => button.style !== 'cancel').onPress();
    await pending;
    assert.equal(flow.applied.length, 1);
    assert.equal(JSON.parse(server.requests.at(-1).options.body).recordarme, recordarme);
    await assert.rejects(previous.checkAuth(), error => error.status === 401);
  }
});

test('Cancelar o descartar el aviso conserva la sesión anterior y no inicia otra', async () => {
  for (const dismiss of [false, true]) {
    const server = sessionServer();
    const previous = createClient(server.fetch);
    await previous.login(credentials);
    const next = createClient(server.fetch);
    const flow = loginFlow(next);
    const pending = flow.authenticate(credentials);
    const [, , buttons, options] = await flow.alert;
    assert.equal(flow.applied.length, 0);
    if (dismiss) options.onDismiss();
    else buttons.find(button => button.style === 'cancel').onPress();
    await pending;
    assert.equal(server.requests.filter(request => request.url.endsWith('/api/auth/login')).length, 2);
    assert.equal((await previous.checkAuth()).authenticated, true);
    assert.equal(flow.applied.length, 0);
    assert.equal(flow.authenticationStates.at(-1), false);
  }
});

test('Aceptar fuerza solo el segundo intento y la sesión anterior queda revocada por el servidor', async () => {
  const server = sessionServer();
  const previous = createClient(server.fetch);
  await previous.login(credentials);
  const next = createClient(server.fetch);
  const flow = loginFlow(next);
  const pending = flow.authenticate(credentials);
  const [, , buttons] = await flow.alert;
  assert.equal(server.requests.length, 2);
  buttons.find(button => button.text === 'Cerrar otra sesión y entrar').onPress();
  await pending;
  const loginRequests = server.requests.map(request => JSON.parse(request.options.body));
  assert.deepEqual(loginRequests.map(request => request.forzar), [false, false, true]);
  assert.equal(flow.applied.length, 1);
  assert.equal((await next.checkAuth()).authenticated, true);
  await assert.rejects(previous.checkAuth(), error => error.status === 401);
  assert.equal(previous.getAuthSessionCookie(), null);
  assert.equal(flow.authenticationStates.at(-1), false);
});

test('Si falla el reemplazo no se autentica ni se reintenta automáticamente', async () => {
  let requests = 0;
  const client = createClient(async () => ++requests === 1
    ? json({ mensaje: 'Sesión abierta en otro dispositivo' }, 409)
    : json({ mensaje: 'El servidor no pudo cerrar la sesión' }, 500));
  const flow = loginFlow(client);
  const pending = flow.authenticate(credentials);
  const [, , buttons] = await flow.alert;
  const rejection = assert.rejects(pending, error => error.status === 500);
  buttons.find(button => button.style !== 'cancel').onPress();
  await rejection;
  assert.equal(requests, 2);
  assert.equal(flow.applied.length, 0);
  assert.equal(flow.authenticationStates.at(-1), false);
});

test('Contraseña, biometría y aceptación de políticas comparten la confirmación de sesión', async () => {
  const attempts = [];
  const bindings = {
    runRequest: async action => action(), authenticate: async request => attempts.push(request),
    ...credentials, validateLogin: () => ({ valid: true }),
    biometricCredentials: credentials, biometricLabel: 'Huella',
    LocalAuthentication: { authenticateAsync: async () => ({ success: true }) },
    privacyPendingLogin: { ...credentials, idUsuario: 7 }, privacyAccepted: true,
    acceptPrivacyPolicy: async () => {}, setPrivacyPendingLogin: () => {},
    setPrivacyAccepted: () => {}, setPrivacyMessage: () => {},
  };
  await loadAction('submitLogin', bindings)();
  await loadAction('submitBiometricLogin', bindings)();
  await loadAction('confirmPrivacyPolicy', bindings)();
  assert.equal(attempts.length, 3);
  assert.ok(attempts.every(request => request.username === credentials.username && !request.forzar));
  assert.equal(attempts[1].recordarme, true);
  await loadAction('submitBiometricLogin', {
    ...bindings, LocalAuthentication: { authenticateAsync: async () => ({ success: false }) },
  })();
  assert.equal(attempts.length, 3);
});

let monitorEffect;
function findMonitor(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0].getText(ast).includes('setAuthFailureHandler(endSession)')) monitorEffect = node.arguments[0];
  ts.forEachChild(node, findMonitor);
}
findMonitor(ast);

function sessionMonitor(client, checkAuth = client.checkAuth) {
  const alerts = [];
  let resets = 0;
  let interval, onChange, intervalCleared = false, listenerRemoved = false;
  const appState = { currentState: 'active', addEventListener: (_event, callback) => {
    onChange = callback;
    return { remove: () => { listenerRemoved = true; } };
  } };
  const setup = evaluate(`exports.setup = ${monitorEffect.getText(ast)};`, {
    currentUser: { idUsuario: 7 }, ApiError: client.ApiError, checkAuth,
    setAuthFailureHandler: client.setAuthFailureHandler, AppState: appState,
    resetLocalSession: () => { resets++; }, Alert: { alert: (...args) => alerts.push(args) },
    setInterval: (callback, delay) => { assert.equal(delay, 60_000); interval = callback; return 1; },
    clearInterval: () => { intervalCleared = true; },
  }).setup;
  const cleanup = setup();
  return { alerts, appState, cleanup, tick: () => interval(), resume: () => onChange('active'),
    get resets() { return resets; }, get cleaned() { return intervalCleared && listenerRemoved; } };
}

test('El dispositivo revocado cierra su pantalla una sola vez, sin esperar a aceptar una alerta', async () => {
  for (const binary of [false, true]) {
    const client = createClient(async () => json({ mensaje: 'Sesión iniciada en otro dispositivo' }, 401));
    const monitor = sessionMonitor(client);
    const request = binary ? client.apiRequestBinary : client.apiRequest;
    await assert.rejects(request('/api/private'), error => error.status === 401);
    await assert.rejects(request('/api/private'), error => error.status === 401);
    assert.equal(monitor.resets, 1);
    assert.equal(monitor.alerts.length, 1);
    assert.match(monitor.alerts[0][1], /otro dispositivo/);
    monitor.cleanup();
    assert.equal(monitor.cleaned, true);
  }
});

test('Comprueba la sesión en primer plano y al volver, sin solapar solicitudes ni cerrar por fallas de red', async () => {
  const client = createClient(async () => json({}));
  let checks = 0, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const monitor = sessionMonitor(client, async () => { checks++; return pending; });
  monitor.appState.currentState = 'background';
  monitor.tick();
  assert.equal(checks, 0);
  monitor.appState.currentState = 'active';
  monitor.resume();
  monitor.tick();
  assert.equal(checks, 1);
  finish({ authenticated: false });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(monitor.resets, 1);
  monitor.cleanup();

  const offline = sessionMonitor(client, async () => { throw new client.ApiError(0, 'Sin conexión'); });
  offline.tick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(offline.resets, 0);
  offline.cleanup();
});

test('Ignora respuestas tardías después de cerrar el monitor y distingue la expiración de otro dispositivo', async () => {
  const client = createClient(async () => json({ mensaje: 'Sesión expirada' }, 401));
  const monitor = sessionMonitor(client);
  monitor.tick();
  monitor.cleanup();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(monitor.resets, 0);
  const active = sessionMonitor(client);
  await assert.rejects(client.apiRequest('/api/private'));
  assert.equal(active.resets, 1);
  assert.doesNotMatch(active.alerts[0][1], /otro dispositivo/);
  active.cleanup();
});
