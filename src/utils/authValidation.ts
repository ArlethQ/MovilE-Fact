import { ChangePasswordRequest, RegisterRequest, TipoDocumento } from '../types/auth';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{10,}$/;
const nameRegex = /^[a-zA-ZÀ-ÿ\s]{2,}$/;

export type ValidationResult = {
  valid: boolean;
  message?: string;
};

export function validateEmail(email: string): ValidationResult {
  const value = email.trim();

  if (!value) {
    return invalid('El correo es obligatorio.');
  }

  if (value.length > 100) {
    return invalid('El correo es demasiado largo.');
  }

  if (!emailRegex.test(value)) {
    return invalid('Formato de correo invalido.');
  }

  return valid();
}

export function validateLogin(username: string, password: string): ValidationResult {
  if (!username.trim() || !password.trim()) {
    return invalid('Usuario y contrasena son obligatorios.');
  }

  return valid();
}

export function validateRegisterForm(form: RegisterRequest): ValidationResult {
  const emailValidation = validateEmail(form.email);
  if (!emailValidation.valid) {
    return emailValidation;
  }

  if (!form.direccion.trim() || form.direccion.trim().length < 5 || form.direccion.trim().length > 100) {
    return invalid('La direccion debe tener entre 5 y 100 caracteres.');
  }

  if (form.tipoCliente === 2) {
    if (!form.razonSocial.trim() || form.razonSocial.trim().length < 3) {
      return invalid('La razon social debe tener al menos 3 caracteres.');
    }
  } else {
    if (!form.nombres.trim() || !nameRegex.test(form.nombres.trim())) {
      return invalid('Ingresa nombres validos.');
    }

    if (!form.apellidos.trim() || !nameRegex.test(form.apellidos.trim())) {
      return invalid('Ingresa apellidos validos.');
    }
  }

  const identificacionValidation = validateIdentificacion(form.tipoDocumento, form.identificacion);
  if (!identificacionValidation.valid) {
    return identificacionValidation;
  }

  if (!passwordRegex.test(form.password)) {
    return invalid('Minimo 8 caracteres, 1 mayuscula, 1 minuscula, 1 numero y 1 especial.');
  }

  return valid();
}

export function validateChangePassword(form: ChangePasswordRequest): ValidationResult {
  if (!form.claveActual.trim()) {
    return invalid('Ingresa la contrasena temporal o codigo de acceso.');
  }

  if (!strongPasswordRegex.test(form.nuevaClave)) {
    return invalid('La clave debe tener al menos 10 caracteres, mayuscula, minuscula, numero y simbolo.');
  }

  if (form.nuevaClave !== form.confirmarClave) {
    return invalid('Las contrasenas no coinciden.');
  }

  return valid();
}

export function sanitizeIdentificacion(tipoDocumento: TipoDocumento, value: string): string {
  if (tipoDocumento === 'PASAPORTE') {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20);
  }

  return value.replace(/\D/g, '').slice(0, 13);
}

export function validateIdentificacion(tipoDocumento: TipoDocumento, value: string): ValidationResult {
  const identificacion = sanitizeIdentificacion(tipoDocumento, value);

  if (!identificacion) {
    return invalid('La identificacion es obligatoria.');
  }

  if (tipoDocumento === 'PASAPORTE') {
    return valid();
  }

  if (tipoDocumento === 'RUC') {
    if (identificacion.length !== 13) {
      return invalid('El RUC debe tener exactamente 13 digitos.');
    }

    if (!validarRucEcuatoriano(identificacion)) {
      return invalid('El RUC ecuatoriano no es valido.');
    }

    return valid();
  }

  if (identificacion.length !== 10) {
    return invalid('La cedula debe tener exactamente 10 digitos.');
  }

  if (!validarCedulaEcuatoriana(identificacion)) {
    return invalid('La cedula ingresada no es valida.');
  }

  return valid();
}

function validarCedulaEcuatoriana(cedula: string): boolean {
  const digits = cedula.replace(/\D/g, '');

  if (digits.length !== 10) {
    return false;
  }

  const provincia = Number(digits.slice(0, 2));
  const tercerDigito = Number(digits.charAt(2));

  if (provincia < 1 || provincia > 24 || tercerDigito > 5) {
    return false;
  }

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const suma = coeficientes.reduce((total, coeficiente, index) => {
    const valor = Number(digits.charAt(index)) * coeficiente;
    return total + (valor > 9 ? valor - 9 : valor);
  }, 0);

  const digitoRecibido = Number(digits.charAt(9));
  const digitoCalculado = (10 - (suma % 10)) % 10;
  return digitoCalculado === digitoRecibido;
}

function validarRucEcuatoriano(ruc: string): boolean {
  const digits = ruc.replace(/\D/g, '');

  if (digits.length !== 13) {
    return false;
  }

  const provincia = Number(digits.slice(0, 2));
  const tercerDigito = Number(digits.charAt(2));

  if (provincia < 1 || provincia > 24) {
    return false;
  }

  if (tercerDigito <= 5) {
    return validarCedulaEcuatoriana(digits.slice(0, 10)) && digits.endsWith('001');
  }

  if (tercerDigito === 6) {
    return validarRucPublico(digits);
  }

  if (tercerDigito === 9) {
    return validarRucPrivado(digits);
  }

  return false;
}

function validarRucPrivado(ruc: string): boolean {
  const coeficientes = [4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = coeficientes.reduce((total, coeficiente, index) => total + Number(ruc.charAt(index)) * coeficiente, 0);
  const residuo = suma % 11;
  const digitoCalculado = residuo === 0 ? 0 : 11 - residuo;
  const digitoRecibido = Number(ruc.charAt(9));

  return digitoCalculado === digitoRecibido && ruc.slice(10) !== '000';
}

function validarRucPublico(ruc: string): boolean {
  const coeficientes = [3, 2, 7, 6, 5, 4, 3, 2];
  const suma = coeficientes.reduce((total, coeficiente, index) => total + Number(ruc.charAt(index)) * coeficiente, 0);
  const residuo = suma % 11;
  const digitoCalculado = residuo === 0 ? 0 : 11 - residuo;
  const digitoRecibido = Number(ruc.charAt(8));

  return digitoCalculado === digitoRecibido && ruc.slice(9) !== '0000';
}

function valid(): ValidationResult {
  return { valid: true };
}

function invalid(message: string): ValidationResult {
  return { valid: false, message };
}