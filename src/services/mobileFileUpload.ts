import { File as ExpoFile } from 'expo-file-system';

export type MobileFileUpload = {
  uri: string;
  name: string;
};

/** Uses Expo's File implementation, which React Native can serialize in multipart requests. */
export function appendMobileFile(form: FormData, field: string, file: MobileFileUpload) {
  form.append(field, new ExpoFile(file.uri), file.name);
}
