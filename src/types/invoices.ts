import type { FacturaProducto } from '../services/facturasMobileService';

export type NuevaFacturaLinea = {
  producto: FacturaProducto;
  cantidad: string;
  precio: string;
  descuento: string;
  tarifa: string;
  detalle?: string;
  cantidadDisponible?: string;
};

export type NuevaFacturaFormState = {
  clienteBusqueda: string;
  productoBusqueda: string;
  serie: string;
  numeroFactura: string;
  formaPago: string;
  tipoIdentificacion: string;
  numeroIdentificacion: string;
  tipoCliente: string;
  obligadoContabilidad: string;
  direccion: string;
  telefono: string;
  correoPrincipal: string;
  referencia: string;
  correoAdicional: string;
  detalleLinea: string;
};

export type NotaCreditoFormState = NuevaFacturaFormState & {
  facturaBusqueda: string;
  motivo: string;
  observacion: string;
};

export type NotaDebitoLinea = {
  descripcion: string;
  precio: string;
  tarifa: string;
  impuestoIce: string;
  valorIce: string;
};

export type NotaDebitoFormState = NuevaFacturaFormState & {
  facturaBusqueda: string;
};
