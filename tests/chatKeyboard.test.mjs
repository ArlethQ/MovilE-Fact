import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/auth/BusinessHomeLayout.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function layout(platform, initiallyVisible = false) {
  let visible;
  let initialized = false;
  const listeners = new Map();
  let cleanup;
  const jsx = (type, props) => ({ type, props });
  const bindings = {
    exports: {},
    require: name => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState: initializer => {
          if (!initialized) {
            visible = typeof initializer === 'function' ? initializer() : initializer;
            initialized = true;
          }
          return [visible, value => { visible = value; }];
        },
        useEffect: effect => { if (!cleanup) cleanup = effect(); },
      };
      if (name === 'react-native') return { Keyboard: {
        isVisible: () => initiallyVisible,
        addListener: (event, callback) => {
          listeners.set(event, callback);
          return { remove: () => listeners.delete(event) };
        },
      } };
      return { useResponsiveLayout: () => ({ horizontalPadding: 18, isCompact: false, isTablet: false }) };
    },
  };
  vm.runInNewContext(compiled, bindings);
  const context = new Proxy({
    activeView: 'bot', Platform: { OS: platform }, canUseEfact: true,
    styles: new Proxy({}, { get: (_target, key) => String(key) }),
    insets: { top: 24, bottom: 34, left: 0, right: 0 },
    getWorkspaceTitle: () => 'Númi', visibleNotifications: [], drawerMenu: [],
    drawerProgress: { interpolate: () => 0 }, Animated: { View: 'Animated.View' },
    EFACT_THEME: { colors: {} }, ERUBRICA_COLORS: {},
  }, { get: (target, key) => key in target ? target[key] : /^[A-Z]/.test(String(key)) ? String(key) : undefined });
  const render = () => bindings.exports.BusinessHomeLayout({ context });
  return {
    render, context, listeners,
    show: () => listeners.get(platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow')(),
    hide: () => listeners.get(platform === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide')(),
    unmount: () => cleanup(),
  };
}

function find(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(child => find(child, type));
  return [...(tree.type === type ? [tree] : []), ...find(tree.props?.children, type)];
}

for (const platform of ['android', 'ios']) {
  test(`${platform}: el teclado deja visible el chat y retira las opciones hasta cerrarse`, () => {
    const screen = layout(platform);
    assert.equal(find(screen.render(), 'PortalBottomNav').length, 1);
    screen.show();
    const editing = screen.render();
    assert.equal(find(editing, 'PortalBottomNav').length, 0);
    assert.equal(find(editing, 'EfactBotScreen').length, 1);
    screen.hide();
    const restored = screen.render();
    assert.equal(find(restored, 'PortalBottomNav').length, 1);
    assert.equal(find(restored, 'PortalBottomNav')[0].props.docked, true);
    screen.unmount();
    assert.equal(screen.listeners.size, 0);
  });
}

test('Abrir el chat con el teclado ya visible no muestra la navegación encima de él', () => {
  const screen = layout('android', true);
  assert.equal(find(screen.render(), 'PortalBottomNav').length, 0);
  screen.hide();
  assert.equal(find(screen.render(), 'PortalBottomNav').length, 1);
  screen.unmount();
});
