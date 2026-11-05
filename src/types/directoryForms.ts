import type { ProductoTipo } from './business';

export type ProductoFormMode = 'create' | 'edit' | null;
export type CategoriaFormMode = 'create' | 'edit' | null;
export type EmisorFormMode = 'create' | 'edit' | null;

export type ProductoFormState = {
  tipo: ProductoTipo;
  nombre: string;
  codigo: string;
  precioBase: string;
  precios: string[];
  iva: boolean;
  tarifa: number | null;
  categoria: number | null;
  subcategoria: number | null;
  estado: boolean;
  observacion: string;
};

export type CategoriaFormState = {
  descripcion: string;
  estado: boolean;
};

export type SubcategoriaFormState = {
  descripcion: string;
  idCategoria: number | null;
  estado: boolean;
};

export type EmisorFormState = {
  razonSocial: string;
  ruc: string;
  nomComercial: string;
  dirEstablecimiento: string;
  direccionMatriz: string;
  telefono: string;
  email: string;
  llevaContabilidad: 'SI' | 'NO';
  logoImagen: string;
  pathCertificado: string;
  firmaArchivoUri: string;
  firmaArchivoNombre: string;
  firmaArchivoMimeType: string;
  claveCertificado: string;
  eliminarClaveCertificado: boolean;
  estado: boolean;
  codEstablecimiento: string;
  codPuntoEmision: string;
  retenciones: string;
  claveInterna: string;
};
