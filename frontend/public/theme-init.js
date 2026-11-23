{
  const KNOWN_THEMES = ["light", "dark", "contrast"];
  const readSavedTheme = () => {
    try {
      return localStorage.getItem("theme");
    } catch {
      return null;
    }
  };
  const savedTheme = readSavedTheme();
  if (KNOWN_THEMES.includes(savedTheme)) document.documentElement.dataset.theme = savedTheme;
}
