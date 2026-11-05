import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { styles } from '../../styles/appStyles';
import type { SubcategoriaCatalogo } from '../../types/business';

export function SubcategoriaCard({ subcategoria, categoriaDescripcion, onView, onEdit, onDelete }: { subcategoria: SubcategoriaCatalogo; categoriaDescripcion?: string | null; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <CatalogCard initials="S" title={subcategoria.descripcion || 'Subcategoria sin descripcion'} subtitle={categoriaDescripcion || 'Sin categoria asociada'} onView={onView} onEdit={onEdit} onDelete={onDelete} />;
}

export function CatalogCard({ initials, title, subtitle, onView, onEdit, onDelete }: { initials: string; title: string; subtitle: string; onView: () => void; onEdit: () => void; onDelete: () => void }) {
  return <View style={styles.crudCard}><View style={styles.clientCardHeader}><View style={styles.clientAvatar}><Text style={styles.clientAvatarText}>{initials}</Text></View><View style={styles.clientInfo}><Text style={styles.clientName}>{title}</Text><Text style={styles.clientMeta}>{subtitle}</Text></View></View><View style={styles.clientActions}><Pressable accessibilityRole="button" accessibilityLabel={`Ver ${title}`} style={[styles.smallActionButton, styles.crudViewAction]} onPress={onView}><MaterialCommunityIcons name="eye-outline" size={16} color="#00649D" /><Text style={styles.smallActionText}>Ver</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Editar ${title}`} style={[styles.smallActionButton, styles.crudEditAction]} onPress={onEdit}><MaterialCommunityIcons name="pencil-outline" size={16} color="#6847FF" /><Text style={styles.crudEditText}>Editar</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Eliminar ${title}`} style={[styles.smallActionButton, styles.smallDangerButton]} onPress={onDelete}><MaterialCommunityIcons name="trash-can-outline" size={16} color="#B4232D" /><Text style={[styles.smallActionText, styles.smallDangerText]}>Eliminar</Text></Pressable></View></View>;
}
