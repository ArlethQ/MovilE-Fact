import { apiRequest } from './apiClient';
import { CiudadLookup, Cliente, ClienteLookups, ClienteUpsert, ProvinciaLookup } from '../types/business';

type ClienteApi = Cliente & {
  Codcliente?: number;
  Apellidos?: string | null;
  Nombres?: string | null;
  Nombrecomercial?: string | null;
  Nombrerazonsocial?: string | null;
  Numeroidentificacion?: string | null;
  Direccion?: string | null;
  Telefonoconvencional?: string | null;
  Celular?: string | null;
  Correo?: string | null;
  DiasCredito?: number | null;
  CorreosAdicionales?: string[];
  Observaciones?: string | null;
  Oblgconta?: string | null;
  TipoCliente?: number | null;
  TclCodigo?: number | null;
  Estado?: boolean | null;
  Pais?: number | null;
  Provincia?: number | null;
  Ciudad?: number | null;
  Tipoidentificacion?: number | null;
  EsProveedor?: boolean;
  CuentaContableProveedor?: string | null;
  CreditoTributarioProveedor?: string | null;
  CodigoProveedor?: string | null;
  EsSujetoRetencionProveedor?: boolean;
  RegistraInformacionBancariaProveedor?: boolean;
  BancoProveedor?: string | null;
  TipoCuentaProveedor?: string | null;
  NumeroCuentaProveedor?: string | null;
};

export function normalizeCliente(cliente: ClienteApi): Cliente {
  const tipoClienteRaw: unknown = cliente.tipoCliente ?? cliente.TipoCliente ?? cliente.TclCodigo;
  const tipoCliente = tipoClienteRaw === null || tipoClienteRaw === undefined || tipoClienteRaw === '' ? null : Number(tipoClienteRaw);
  return {
    codcliente: cliente.codcliente ?? cliente.Codcliente ?? 0,
    apellidos: cliente.apellidos ?? cliente.Apellidos,
    nombres: cliente.nombres ?? cliente.Nombres,
    nombrecomercial: cliente.nombrecomercial ?? cliente.Nombrecomercial,
    nombrerazonsocial: cliente.nombrerazonsocial ?? cliente.Nombrerazonsocial,
    numeroidentificacion: cliente.numeroidentificacion ?? cliente.Numeroidentificacion,
    direccion: cliente.direccion ?? cliente.Direccion,
    telefonoconvencional: cliente.telefonoconvencional ?? cliente.Telefonoconvencional,
    celular: cliente.celular ?? cliente.Celular,
    correo: cliente.correo ?? cliente.Correo,
    diasCredito: cliente.diasCredito ?? cliente.DiasCredito,
    correosAdicionales: cliente.correosAdicionales ?? cliente.CorreosAdicionales ?? [],
    observaciones: cliente.observaciones ?? cliente.Observaciones,
    oblgconta: cliente.oblgconta ?? cliente.Oblgconta,
    tipoCliente: Number.isFinite(tipoCliente) ? tipoCliente : null,
    estado: cliente.estado ?? cliente.Estado,
    pais: cliente.pais ?? cliente.Pais,
    provincia: cliente.provincia ?? cliente.Provincia,
    ciudad: cliente.ciudad ?? cliente.Ciudad,
    tipoidentificacion: cliente.tipoidentificacion ?? cliente.Tipoidentificacion,
    esProveedor: cliente.esProveedor ?? cliente.EsProveedor,
    cuentaContableProveedor: cliente.cuentaContableProveedor ?? cliente.CuentaContableProveedor,
    creditoTributarioProveedor: cliente.creditoTributarioProveedor ?? cliente.CreditoTributarioProveedor,
    codigoProveedor: cliente.codigoProveedor ?? cliente.CodigoProveedor,
    esSujetoRetencionProveedor: cliente.esSujetoRetencionProveedor ?? cliente.EsSujetoRetencionProveedor,
    registraInformacionBancariaProveedor: cliente.registraInformacionBancariaProveedor ?? cliente.RegistraInformacionBancariaProveedor,
    bancoProveedor: cliente.bancoProveedor ?? cliente.BancoProveedor,
    tipoCuentaProveedor: cliente.tipoCuentaProveedor ?? cliente.TipoCuentaProveedor,
    numeroCuentaProveedor: cliente.numeroCuentaProveedor ?? cliente.NumeroCuentaProveedor,
  };
}

export async function getClientes(userId: number, incluirInactivos = false) {
  const clientes = await apiRequest<ClienteApi[]>(`/api/clientes?userId=${userId}&incluirInactivos=${incluirInactivos}`);
  return clientes.map(normalizeCliente);
}

export async function createCliente(userId: number, cliente: ClienteUpsert) {
  return apiRequest<{ Codcliente?: number; codcliente?: number }>(`/api/clientes?userId=${userId}`, {
    method: 'POST',
    body: JSON.stringify(cliente),
  });
}

export async function updateCliente(userId: number, codcliente: number, cliente: ClienteUpsert) {
  return apiRequest<void>(`/api/clientes/${codcliente}?userId=${userId}`, {
    method: 'PUT',
    body: JSON.stringify(cliente),
  });
}

export async function deleteCliente(userId: number, codcliente: number) {
  return apiRequest<void>(`/api/clientes/${codcliente}/desactivar?userId=${userId}`, {
    method: 'PUT',
  });
}

export function getClienteLookups() {
  return apiRequest<ClienteLookups>('/api/clientes/lookups');
}

export function getProvincias(paisId: number) {
  return apiRequest<ProvinciaLookup[]>(`/api/clientes/provincias?paisId=${paisId}`);
}

export function getCiudades(provinciaId: number) {
  return apiRequest<CiudadLookup[]>(`/api/clientes/ciudades?provinciaId=${provinciaId}`);
}
