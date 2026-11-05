import type { FacturaProducto } from '../services/facturasMobileService';
import type { NuevaFacturaFormState } from './invoices';

export type LiquidacionCompraFormState = NuevaFacturaFormState & {
  diasCredito: string;
};

export type GuiaRemisionDetalle = {
  producto: FacturaProducto;
  cantidad: string;
};

export type GuiaRemisionFormState = NuevaFacturaFormState & {
  transportistaBusqueda: string;
  clienteBusquedaGuia: string;
  facturaBusqueda: string;
  placa: string;
  contribuyenteEspecial: string;
  transportistaObligadoContabilidad: boolean;
  fechaEmision: string;
  fechaInicioTraslado: string;
  fechaFinTraslado: string;
  direccionOrigen: string;
};
