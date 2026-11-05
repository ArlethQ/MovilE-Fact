import type * as DocumentPicker from 'expo-document-picker';

export type ERubricaTab =
  | 'inicio'
  | 'solicitudes'
  | 'firmas'
  | 'documentos-por-firmar'
  | 'historial-documentos'
  | 'validar-firma'
  | 'firmar'
  | 'validar'
  | 'nueva-solicitud'
  | 'historial-solicitudes'
  | 'ver-mis-firmas'
  | 'plan-disponible'
  | 'firma-config'
  | 'renovacion'
  | 'proveedor'
  | 'catalogos'
  | 'soporte'
  | 'asistente';

export type SolicitudDocumentoKey =
  | 'cedulaFrontal'
  | 'cedulaPosterior'
  | 'selfieCedula'
  | 'videoAceptacion'
  | 'rucFile'
  | 'nombramiento'
  | 'constitucion'
  | 'cedulaRepresentante'
  | 'autorizacion'
  | 'aceptacionNombramiento'
  | 'archivoAdicional';

export const getERubricaTabTitle = (tab: ERubricaTab) => {
  const titles: Record<ERubricaTab, string> = {
    inicio: 'Inicio', solicitudes: 'Solicitudes', firmas: 'Firmas', 'documentos-por-firmar': 'Documentos por firmar',
    'historial-documentos': 'Historial documentos', 'validar-firma': 'Validar firma', firmar: 'Firmar PDF', validar: 'Validar documento',
    'nueva-solicitud': 'Solicitar firma', 'historial-solicitudes': 'Historial de solicitudes', 'ver-mis-firmas': 'Mis firmas',
    'plan-disponible': 'Plan disponible', 'firma-config': 'Configurar firma', renovacion: 'Renovación', proveedor: 'Proveedor',
    catalogos: 'Catálogos', soporte: 'Soporte', asistente: 'Númi',
  };
  return titles[tab];
};

export const SOLICITUD_FORM_INITIAL = {
  tipoDocumento: '', identificacion: '', codigoDactilar: '', poseeRuc: false, ruc: '', nombres: '', primerApellido: '', segundoApellido: '',
  fechaNacimiento: '', sexo: '', nacionalidad: 'ECUATORIANA', celular: '', correo: '', telefonoSecundario: '',
  correoSecundario: '', provincia: '', canton: '', direccion: '', razonSocialEmpresa: '', departamento: '', cargo: '',
  motivoFirma: '', representanteTipoDocumento: '', representanteIdentificacion: '', representanteNombres: '', representanteApellidos: '',
};

export const SOLICITUD_FILES_INITIAL: Record<SolicitudDocumentoKey, DocumentPicker.DocumentPickerAsset | null> = {
  cedulaFrontal: null, cedulaPosterior: null, selfieCedula: null, videoAceptacion: null, rucFile: null, nombramiento: null,
  constitucion: null, cedulaRepresentante: null, autorizacion: null, aceptacionNombramiento: null, archivoAdicional: null,
};

export const SOLICITUD_UBICACIONES_ECUADOR = [
  ['Azuay', ['Camilo Ponce Enríquez', 'Chordeleg', 'Cuenca', 'El Pan', 'Girón', 'Guachapala', 'Gualaceo', 'Nabón', 'Oña', 'Paute', 'Pucará', 'San Fernando', 'Santa Isabel', 'Sevilla de Oro', 'Sígsig']],
  ['Bolívar', ['Caluma', 'Chillanes', 'Chimbo', 'Echeandía', 'Guaranda', 'Las Naves', 'San Miguel']],
  ['Cañar', ['Azogues', 'Biblián', 'Cañar', 'Déleg', 'El Tambo', 'La Troncal', 'Suscal']],
  ['Carchi', ['Bolívar', 'Espejo', 'Mira', 'Montúfar', 'San Pedro de Huaca', 'Tulcán']],
  ['Chimborazo', ['Alausí', 'Chambo', 'Chunchi', 'Colta', 'Cumandá', 'Guamote', 'Guano', 'Pallatanga', 'Penipe', 'Riobamba']],
  ['Cotopaxi', ['La Maná', 'Latacunga', 'Pangua', 'Pujilí', 'Salcedo', 'Saquisilí', 'Sigchos']],
  ['El Oro', ['Arenillas', 'Atahualpa', 'Balsas', 'Chilla', 'El Guabo', 'Huaquillas', 'Las Lajas', 'Machala', 'Marcabelí', 'Pasaje', 'Piñas', 'Portovelo', 'Santa Rosa', 'Zaruma']],
  ['Esmeraldas', ['Atacames', 'Eloy Alfaro', 'Esmeraldas', 'Muisne', 'Quinindé', 'Rioverde', 'San Lorenzo']],
  ['Galápagos', ['Isabela', 'San Cristóbal', 'Santa Cruz']],
  ['Guayas', ['Alfredo Baquerizo Moreno (Juján)', 'Balao', 'Balzar', 'Colimes', 'Coronel Marcelino Maridueña', 'Daule', 'Durán', 'El Empalme', 'El Triunfo', 'Guayaquil', 'Milagro', 'Naranjal', 'Naranjito', 'Nobol', 'Playas', 'Salitre', 'Samborondón', 'Santa Lucía', 'Simón Bolívar', 'Yaguachi']],
  ['Imbabura', ['Antonio Ante', 'Cotacachi', 'Ibarra', 'Otavalo', 'Pimampiro', 'San Miguel de Urcuquí']],
  ['Loja', ['Calvas', 'Catamayo', 'Celica', 'Chaguarpamba', 'Espíndola', 'Gonzanamá', 'Loja', 'Macará', 'Olmedo', 'Paltas', 'Pindal', 'Puyango', 'Quilanga', 'Saraguro', 'Sozoranga']],
  ['Los Ríos', ['Baba', 'Babahoyo', 'Buena Fe', 'Mocache', 'Montalvo', 'Palenque', 'Puebloviejo', 'Quevedo', 'Quinsaloma', 'Urdaneta', 'Valencia', 'Ventanas', 'Vinces']],
  ['Manabí', ['24 de Mayo', 'Bolívar', 'Chone', 'El Carmen', 'Flavio Alfaro', 'Jama', 'Jaramijó', 'Jipijapa', 'Junín', 'Manta', 'Montecristi', 'Olmedo', 'Paján', 'Pedernales', 'Pichincha', 'Portoviejo', 'Puerto López', 'Rocafuerte', 'San Vicente', 'Santa Ana', 'Sucre', 'Tosagua']],
  ['Morona Santiago', ['Gualaquiza', 'Huamboya', 'Limón Indanza', 'Logroño', 'Morona (Macas)', 'Pablo Sexto', 'Palora', 'San Juan Bosco', 'Santiago de Méndez', 'Sucúa', 'Taisha', 'Tiwintza']],
  ['Napo', ['Archidona', 'Carlos Julio Arosemena Tola', 'El Chaco', 'Quijos', 'Tena']],
  ['Orellana', ['Aguarico', 'Francisco de Orellana', 'La Joya de los Sachas', 'Loreto']],
  ['Pastaza', ['Arajuno', 'Mera', 'Pastaza', 'Santa Clara']],
  ['Pichincha', ['Cayambe', 'Mejía', 'Pedro Moncayo', 'Pedro Vicente Maldonado', 'Puerto Quito', 'Quito', 'Rumiñahui', 'San Miguel de los Bancos']],
  ['Santa Elena', ['La Libertad', 'Salinas', 'Santa Elena']],
  ['Santo Domingo de los Tsáchilas', ['La Concordia', 'Santo Domingo']],
  ['Sucumbíos', ['Cascales', 'Cuyabeno', 'Gonzalo Pizarro', 'Lago Agrio', 'Putumayo', 'Shushufindi', 'Sucumbíos']],
  ['Tungurahua', ['Ambato', 'Baños de Agua Santa', 'Cevallos', 'Mocha', 'Patate', 'Pelileo', 'Píllaro', 'Quero', 'Tisaleo']],
  ['Zamora Chinchipe', ['Centinela del Cóndor', 'Chinchipe', 'El Pangui', 'Nangaritza', 'Palanda', 'Paquisha', 'Yacuambi', 'Yantzaza', 'Zamora']],
] as const;
