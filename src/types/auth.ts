export type TipoDocumento = 'CEDULA' | 'RUC' | 'PASAPORTE';

export type LoginRequest = {
  username: string;
  password: string;
  recordarme: boolean;
};

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  jwt?: string;
  jwtToken?: string;
  bearerToken?: string;
  data?: {
    token?: string;
    accessToken?: string;
    jwt?: string;
    jwtToken?: string;
    bearerToken?: string;
  };
  success?: boolean;
  requierePoliticas?: boolean;
  requiereCambioClave?: boolean;
  idUsuario?: number;
  idTipoUsuario?: number;
  nombres?: string;
  apellidos?: string;
  email?: string;
  avatarUrl?: string;
  tipoCliente?: number;
  idJefe?: number;
  estadoAsociado?: boolean;
  menus?: DynamicMenu[];
  menuItems?: DynamicMenu[];
  servicios?: ServiceAccess[];
  claims?: UserClaims;
};

export type UserClaims = {
  IdTipoUsuario?: number;
  idTipoUsuario?: number;
  TipoCliente?: number;
  tipoCliente?: number;
  IdUsuario?: number;
  idUsuario?: number;
  IdJefe?: number | null;
  idJefe?: number | null;
  EstadoAsociado?: boolean;
  estadoAsociado?: boolean;
};

export type DynamicMenu = {
  id?: number;
  idMenu?: number;
  idPadre?: number | null;
  padreId?: number | null;
  nombre?: string;
  descripcion?: string | null;
  ruta?: string | null;
  icono?: string | null;
  orden?: number | null;
  estado?: boolean | null;
  habilitado?: boolean | null;
  servicio?: string | null;
  codigoServicio?: string | null;
  hijos?: DynamicMenu[];
  children?: DynamicMenu[];
};

export type ServiceAccess = {
  codigo?: string;
  nombre?: string;
  ruta?: string | null;
  estado?: boolean | null;
  habilitado?: boolean | null;
};

export type RegisterRequest = {
  nombres: string;
  apellidos: string;
  razonSocial: string;
  email: string;
  direccion: string;
  celular: string;
  tipoDocumento: TipoDocumento;
  identificacion: string;
  password: string;
  avatarUrl: string;
  tipoCliente: number;
};

export type RegisterResponse = {
  success: boolean;
  idUsuario: number;
  message?: string;
};

export type RecoverPasswordRequest = {
  email: string;
};

export type RecoverPasswordResponse = {
  success: boolean;
  message: string;
  idUsuario?: number;
};

export type ChangePasswordRequest = {
  idUsuario: number;
  claveActual: string;
  nuevaClave: string;
  confirmarClave: string;
};

export type ChangePasswordResponse = {
  success: boolean;
  message?: string;
};

export type AuthCheckResponse = {
  authenticated: boolean;
  idUsuario: number;
} & LoginResponse;
