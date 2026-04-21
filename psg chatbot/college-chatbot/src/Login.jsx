import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createTheme, ThemeProvider, CssBaseline, alpha } from "@mui/material";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import SchoolIcon from "@mui/icons-material/School";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

const API = import.meta.env.VITE_API_URL;

const buildTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#2563EB", dark: "#1D4ED8", light: "#3B82F6" },
      background: {
        default: mode === "dark" ? "#0F172A" : "#F8FAFC",
        paper:   mode === "dark" ? "#1E293B" : "#FFFFFF",
      },
      text: {
        primary:   mode === "dark" ? "#F1F5F9" : "#0F172A",
        secondary: mode === "dark" ? "#94A3B8" : "#475569",
        disabled:  mode === "dark" ? "#334155" : "#CBD5E1",
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton: { styleOverrides: { root: { textTransform: "none" } } },
    },
  });

export default function Login() {
  const [mode, setMode]       = useState("light");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setMode(saved);
  }, []);

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem("theme", next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem("auth_token", data.token);
        navigate("/", { replace: true });
      } else {
        setError(data.error || "Invalid credentials");
      }
    } catch {
      setError("Cannot connect to server. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const theme = buildTheme(mode);
  const borderColor = mode === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)";

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Theme toggle — top right */}
      <Box sx={{ position: "fixed", top: 16, right: 20 }}>
        <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
          <IconButton onClick={toggleMode} size="small" sx={{
            border: `1px solid ${borderColor}`, borderRadius: "8px", p: 0.75, color: "text.secondary",
          }}>
            {mode === "dark" ? <LightModeOutlinedIcon sx={{ fontSize: 17 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 17 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* Centered layout */}
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 3, bgcolor: "background.default" }}>
        <Paper elevation={0} sx={{
          width: "100%", maxWidth: 400,
          border: `1px solid ${borderColor}`,
          borderRadius: "20px", p: "36px 32px 28px",
          boxShadow: mode === "dark"
            ? "0 8px 48px rgba(0,0,0,.4), 0 0 0 1px rgba(37,99,235,.15)"
            : "0 8px 48px rgba(0,0,0,.08), 0 0 0 1px rgba(37,99,235,.1)",
        }}>

          {/* Brand */}
          <Box sx={{ textAlign: "center", mb: 3.5 }}>
            <Avatar sx={{
              width: 52, height: 52, borderRadius: "16px",
              background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
              mx: "auto", mb: 1.75,
              boxShadow: "0 8px 24px rgba(37,99,235,.35)",
            }}>
              <SchoolIcon sx={{ fontSize: 26 }} />
            </Avatar>
            <Typography sx={{ fontSize: 22, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1.2 }}>
              PSG Tech{" "}
              <Box component="span" sx={{ background: "linear-gradient(90deg,#1D4ED8,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                AI
              </Box>
            </Typography>
            <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>
              Sign in to continue
            </Typography>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Username"
              placeholder="Enter username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required autoFocus fullWidth size="small"
              slotProps={{ input: { sx: { borderRadius: "10px", fontSize: 14 } } }}
            />
            <TextField
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required fullWidth size="small"
              slotProps={{ input: { sx: { borderRadius: "10px", fontSize: 14 } } }}
            />

            {error && (
              <Alert severity="error" sx={{ borderRadius: "10px", fontSize: 12.5 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={loading}
              sx={{
                mt: 0.5, py: 1.25, borderRadius: "10px", fontSize: 14,
                background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                boxShadow: "0 4px 20px rgba(37,99,235,.35)",
                "&:hover": { opacity: 0.9, boxShadow: "0 6px 24px rgba(37,99,235,.45)" },
              }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </Box>

          <Typography sx={{ textAlign: "center", mt: 2.5, fontSize: 11, color: "text.disabled" }}>
            Powered by Mistral · PSG College of Technology
          </Typography>
        </Paper>
      </Box>
    </ThemeProvider>
  );
}
