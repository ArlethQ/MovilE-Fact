module.exports = ({ config }) => {
  if (process.env.EFACT_EXPO_ANDROID_LOCAL !== '1') return config;

  return {
    ...config,
    name: `${config.name} · Local`,
    slug: `${config.slug}-android-local`,
  };
};
