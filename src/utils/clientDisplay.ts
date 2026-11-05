import type { FacturaProducto } from '../services/facturasMobileService';
import type { Cliente } from '../types/business';

export function getClienteDisplayName(cliente: Cliente) {
  const row = cliente as Cliente & Record<string, unknown>;
  return String(
    cliente.nombrerazonsocial ||
      row.Nombrerazonsocial ||
      row.NombreRazonSocial ||
      [cliente.nombres || row.Nombres, cliente.apellidos || row.Apellidos].filter(Boolean).join(' ') ||
      cliente.numeroidentificacion ||
      row.Numeroidentificacion ||
      row.NumeroIdentificacion ||
      'Cliente',
  );
}

export function getClienteIdentification(cliente: Cliente) {
  const row = cliente as Cliente & Record<string, unknown>;
  return String(cliente.numeroidentificacion || row.Numeroidentificacion || row.NumeroIdentificacion || '');
}

export function getClienteEmail(cliente: Cliente) {
  const row = cliente as Cliente & Record<string, unknown>;
  return String(cliente.correo || row.Correo || row.Email || '');
}

export function getClienteKey(cliente: Cliente, index: number) {
  const row = cliente as Cliente & Record<string, unknown>;
  return String(cliente.codcliente || row.Codcliente || row.CodCliente || getClienteIdentification(cliente) || `${getClienteDisplayName(cliente)}-${index}`);
}

export function isConsumidorFinal(cliente: Cliente) {
  const identificacion = (cliente.numeroidentificacion ?? '').trim();
  if (identificacion === '9999999999999') return true;

  const nombres = (cliente.nombres ?? '').trim().toLowerCase();
  const apellidos = (cliente.apellidos ?? '').trim().toLowerCase();
  const correo = (cliente.correo ?? '').trim().toLowerCase();

  return nombres === 'consumidor' && apellidos === 'final' && correo === 'consumidorfinal@numerica';
}

export function getFacturaProductoKey(producto: FacturaProducto, index: number, prefix = 'factura-producto') {
  const identity = producto.codproducto || producto.codprincipal || producto.descripcion || 'sin-codigo';
  return `${prefix}-${String(identity).trim().replace(/\s+/g, '-').slice(0, 80)}-${index}`;
}
