
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme] = useState<Theme>("light");

  useEffect(() => {
    // Update the HTML class when theme changes
    const html = document.documentElement;
    
    html.classList.remove("dark");
    
    // Add smooth transition class
    html.style.transition = "background-color 0.3s ease, color 0.3s ease";
  }, [theme]);

  const toggleTheme = () => undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
