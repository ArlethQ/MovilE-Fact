import { apiRequest } from './apiClient';
import {
  AuthCheckResponse,
  ChangePasswordRequest,
  ChangePasswordResponse,
  LoginRequest,
  LoginResponse,
  RecoverPasswordRequest,
  RecoverPasswordResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/auth';

export function login(request: LoginRequest) {
  return apiRequest<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      username: request.username.trim(),
      password: request.password.trim(),
      recordarme: request.recordarme,
    }),
  });
}

export function checkAuth() {
  return apiRequest<AuthCheckResponse>('/api/auth/check');
}

export function logout() {
  return apiRequest<{ success: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
}

export function register(request: RegisterRequest) {
  return apiRequest<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      ...request,
      email: request.email.trim().toLowerCase(),
      nombres: request.nombres.trim(),
      apellidos: request.apellidos.trim(),
      razonSocial: request.razonSocial.trim(),
      direccion: request.direccion.trim(),
      celular: request.celular.trim(),
      identificacion: request.identificacion.trim(),
    }),
  });
}

export function acceptPrivacyPolicy(request: { idUsuario: number; username: string; password: string }) {
  return apiRequest<{ success: boolean; message?: string }>('/api/auth/accept-privacy-policy', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function recoverPassword(request: RecoverPasswordRequest) {
  return apiRequest<RecoverPasswordResponse>('/api/auth/recover-password', {
    method: 'POST',
    body: JSON.stringify({
      email: request.email.trim().toLowerCase(),
    }),
  });
}

export function changePassword(request: ChangePasswordRequest) {
  return apiRequest<ChangePasswordResponse>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({
      idUsuario: request.idUsuario,
      claveActual: request.claveActual.trim(),
      nuevaClave: request.nuevaClave,
      confirmarClave: request.confirmarClave,
    }),
  });
}
