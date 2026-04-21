import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createTheme, ThemeProvider, CssBaseline, alpha } from "@mui/material";

import Box from "@mui/material/Box";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import SchoolIcon from "@mui/icons-material/School";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import MenuIcon from "@mui/icons-material/Menu";
import ChatBubbleOutlinedIcon from "@mui/icons-material/ChatBubbleOutlined";

const API = import.meta.env.VITE_API_URL;

const CHIPS = [
  "Who is the ECE HOD?",
  "When does the semester end?",
  "List all upcoming events",
  "Holiday list for 2025",
];

// Store component types, not JSX — avoids hook-outside-tree errors
const CARDS = [
  { Icon: GroupOutlinedIcon,         title: "Faculty Info",      desc: "Find faculty details, HODs and department contacts" },
  { Icon: CalendarMonthOutlinedIcon, title: "Academic Calendar", desc: "Exam schedules, holidays and semester timetables" },
  { Icon: CelebrationOutlinedIcon,   title: "College Events",    desc: "Live updates on fests, seminars and announcements" },
];

const buildTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#2563EB", dark: "#1D4ED8", light: "#3B82F6" },
      error:   { main: "#EF4444" },
      background: {
        default: mode === "dark" ? "#0F172A" : "#F8FAFC",
        paper:   mode === "dark" ? "#1E293B" : "#FFFFFF",
      },
      text: {
        primary:   mode === "dark" ? "#F1F5F9" : "#0F172A",
        secondary: mode === "dark" ? "#94A3B8" : "#475569",
        disabled:  mode === "dark" ? "#334155" : "#CBD5E1",
      },
      divider: mode === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)",
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
    },
    shape: { borderRadius: 10 },
    components: {
      MuiButton:   { styleOverrides: { root: { textTransform: "none", fontWeight: 600 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 13 } } },
    },
  });

export default function App() {
  const [mode, setMode]           = useState("light");
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [chats, setChats]         = useState([]);
  const [anchorEl, setAnchorEl]   = useState(null);
  const [sidebarOpen, setSidebar] = useState(true);
  const [renameDialog, setRenameDialog] = useState({ open: false, id: null, value: "" });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, title: "" });
  const bottomRef                 = useRef(null);
  const navigate                  = useNavigate();
  const { id: urlId }             = useParams();
  const activeChatId              = urlId ? Number(urlId) : null;

  const theme       = buildTheme(mode);
  const activeChat  = chats.find(c => c.id === activeChatId);
  const hasMessages = activeChat?.messages.length > 0;
  const menuOpen    = Boolean(anchorEl);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") setMode(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", mode);
  }, [mode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading]);

  // Load conversation list + resolve URL to an active chat on mount
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const res  = await fetch(`${API}/conversations`);
        const data = await res.json();
        if (cancelled) return;
        const list = data.map(c => ({ ...c, messages: [] }));
        setChats(list);

        let target;
        if (urlId && list.some(c => c.id === Number(urlId))) {
          target = Number(urlId);
        } else if (list.length > 0) {
          target = list[0].id;
        } else {
          const newRes = await fetch(`${API}/conversations`, { method: "POST" });
          const c      = await newRes.json();
          if (cancelled) return;
          setChats([{ ...c, messages: [] }]);
          target = c.id;
        }

        if (target !== Number(urlId)) {
          navigate(`/chat/${target}`, { replace: true });
        }
      } catch { /* ignore */ }
    };
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages whenever the active conversation changes
  useEffect(() => {
    if (!activeChatId) return;
    setMsgsLoading(true);
    fetch(`${API}/conversations/${activeChatId}/messages`)
      .then(r => r.json())
      .then(msgs => setChats(prev => prev.map(c =>
        c.id === activeChatId ? { ...c, messages: msgs } : c
      )))
      .catch(() => {})
      .finally(() => setMsgsLoading(false));
  }, [activeChatId]);

  const toggleMode = () => setMode(m => m === "dark" ? "light" : "dark");

  const pushMessage = (msg) =>
    setChats(prev =>
      prev.map(c =>
        c.id === activeChatId
          ? {
              ...c,
              title: c.messages.length === 0 && msg.role === "user"
                ? msg.content.slice(0, 30)
                : c.title,
              messages: [...c.messages, msg],
            }
          : c
      )
    );

  const handleSend = async (text) => {
    const q = (text ?? message).trim();
    if (!q) return;
    setMessage("");
    const history = (activeChat?.messages ?? []).map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));
    pushMessage({ role: "user", content: q });
    setLoading(true);
    try {
      const res  = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, history, conversation_id: activeChatId }),
      });
      const data = await res.json();
      pushMessage({ role: "bot", content: data.answer || "No response", route: data.route });
      // Reflect auto-title set by backend on first message
      setChats(prev => prev.map(c =>
        c.id === activeChatId && c.title === "New Chat"
          ? { ...c, title: q.slice(0, 40) }
          : c
      ));
    } catch {
      pushMessage({ role: "bot", content: "Error connecting to server." });
    } finally {
      setLoading(false);
    }
  };

  const newChat = async () => {
    try {
      const res = await fetch(`${API}/conversations`, { method: "POST" });
      const c   = await res.json();
      setChats(prev => [{ ...c, messages: [] }, ...prev]);
      navigate(`/chat/${c.id}`);
    } catch { /* ignore */ }
  };

  const openRename = (id, currentTitle, e) => {
    e.stopPropagation();
    setRenameDialog({ open: true, id, value: currentTitle });
  };

  const submitRename = async () => {
    const { id, value } = renameDialog;
    const title = value.trim();
    if (!title) return;
    setRenameDialog({ open: false, id: null, value: "" });
    setChats(prev => prev.map(c => c.id === id ? { ...c, title } : c));
    await fetch(`${API}/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).catch(() => {});
  };

  const openDelete = (id, title, e) => {
    e.stopPropagation();
    setDeleteDialog({ open: true, id, title });
  };

  const confirmDelete = async () => {
    const { id } = deleteDialog;
    setDeleteDialog({ open: false, id: null, title: "" });
    try {
      await fetch(`${API}/conversations/${id}`, { method: "DELETE" });
    } catch { /* ignore */ }

    const remaining = chats.filter(c => c.id !== id);
    setChats(remaining);

    if (activeChatId !== id) return;

    if (remaining.length > 0) {
      navigate(`/chat/${remaining[0].id}`, { replace: true });
      return;
    }
    try {
      const res = await fetch(`${API}/conversations`, { method: "POST" });
      const c   = await res.json();
      setChats([{ ...c, messages: [] }]);
      navigate(`/chat/${c.id}`, { replace: true });
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    setAnchorEl(null);
    const token = localStorage.getItem("auth_token");
    try {
      await fetch(`${API}/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
    localStorage.removeItem("auth_token");
    navigate("/login", { replace: true });
  };

  const border = mode === "dark" ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)";

  const inputSlotProps = {
    input: { sx: { borderRadius: "13px", fontSize: 14, pr: 0.75 } },
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", height: "100vh", overflow: "hidden" }}>

        {/* ── SIDEBAR ── */}
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <Box sx={{
            width: sidebarOpen ? 256 : 64,
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
            height: "100vh",
            overflow: "hidden",
            bgcolor: "background.default",
            borderRight: `1px solid ${border}`,
            display: "flex", flexDirection: "column",
            p: 0,
          }}>

            {/* Sidebar header — matches AppBar height */}
            <Box sx={{
              height: 56, minHeight: 56, flexShrink: 0,
              display: "flex", alignItems: "center",
              justifyContent: sidebarOpen ? "flex-start" : "center",
              px: sidebarOpen ? 1.5 : 0,
              borderBottom: `1px solid ${border}`,
              gap: 1,
              overflow: "hidden",
            }}>
              {/* Hamburger toggle */}
              <Tooltip title={sidebarOpen ? "Collapse" : "Expand"} placement="right">
                <IconButton
                  onClick={() => setSidebar(o => !o)}
                  size="small"
                  sx={{ flexShrink: 0, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                >
                  <MenuIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>

              {/* Logo + name — fades out on collapse */}
              <Box sx={{
                display: "flex", alignItems: "center", gap: 1,
                overflow: "hidden", whiteSpace: "nowrap",
                opacity: sidebarOpen ? 1 : 0,
                maxWidth: sidebarOpen ? 180 : 0,
                transition: "opacity 0.2s, max-width 0.2s",
              }}>
                <Avatar sx={{
                  width: 28, height: 28, borderRadius: "8px", flexShrink: 0,
                  background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                  boxShadow: "0 0 10px rgba(37,99,235,.25)",
                }}>
                  <SchoolIcon sx={{ fontSize: 15 }} />
                </Avatar>
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.2 }}>
                    PSG Tech AI
                  </Typography>
                  <Typography sx={{ fontSize: 10, color: "text.disabled" }}>
                    College Assistant
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Scrollable body */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", p: "10px 8px", overflow: "hidden" }}>

            {/* New Chat */}
            <Tooltip title={sidebarOpen ? "" : "New Chat"} placement="right">
              <Button
                onClick={newChat}
                sx={{
                  my: 1,
                  minWidth: 0,
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  px: sidebarOpen ? 1.5 : 1,
                  border: `1px dashed ${alpha("#2563EB", 0.35)}`,
                  bgcolor: alpha("#2563EB", 0.06), color: "primary.main", fontSize: 13,
                  "&:hover": { bgcolor: alpha("#2563EB", 0.12), borderColor: "primary.main" },
                }}
              >
                <AddIcon sx={{ fontSize: 18, flexShrink: 0 }} />
                <Box sx={{
                  overflow: "hidden", ml: sidebarOpen ? 0.75 : 0,
                  maxWidth: sidebarOpen ? 160 : 0,
                  transition: "max-width 0.2s, margin 0.2s",
                  whiteSpace: "nowrap",
                }}>
                  New Chat
                </Box>
              </Button>
            </Tooltip>

            {/* Section label */}
            <Box sx={{
              overflow: "hidden",
              maxHeight: sidebarOpen ? 32 : 0,
              opacity: sidebarOpen ? 1 : 0,
              transition: "max-height 0.2s, opacity 0.15s",
            }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "text.disabled", px: 1, py: 0.75 }}>
                Chats
              </Typography>
            </Box>

            {/* Chat list */}
            <List dense disablePadding sx={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {chats.map(c => (
                <Tooltip key={c.id} title={sidebarOpen ? "" : c.title} placement="right">
                  <ListItemButton
                    selected={c.id === activeChatId}
                    onClick={() => navigate(`/chat/${c.id}`)}
                    sx={{
                      borderRadius: "8px", mb: 0.25,
                      py: 0.75,
                      px: sidebarOpen ? 1.25 : 1,
                      justifyContent: sidebarOpen ? "flex-start" : "center",
                      "&.Mui-selected": { bgcolor: alpha("#2563EB", 0.1) },
                      "&.Mui-selected:hover": { bgcolor: alpha("#2563EB", 0.14) },
                      "&:hover .chat-action": { opacity: 1 },
                      minWidth: 0,
                    }}
                  >
                    {sidebarOpen ? (
                      <>
                        <FiberManualRecordIcon sx={{ fontSize: 6, mr: 1, flexShrink: 0, color: c.id === activeChatId ? "primary.main" : "text.disabled" }} />
                        <ListItemText
                          primary={c.title}
                          slotProps={{
                            primary: {
                              noWrap: true,
                              sx: { fontSize: 13, color: c.id === activeChatId ? "text.primary" : "text.secondary", fontWeight: c.id === activeChatId ? 500 : 400 },
                            },
                          }}
                        />
                        <Tooltip title="Rename">
                          <IconButton
                            className="chat-action"
                            size="small"
                            onClick={(e) => openRename(c.id, c.title, e)}
                            sx={{ opacity: 0, transition: "opacity .15s", p: 0.25, color: "text.secondary", "&:hover": { color: "primary.main" } }}
                          >
                            <EditOutlinedIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            className="chat-action"
                            size="small"
                            onClick={(e) => openDelete(c.id, c.title, e)}
                            sx={{ opacity: 0, transition: "opacity .15s", p: 0.25, ml: 0.25, color: "text.secondary", "&:hover": { color: "error.main" } }}
                          >
                            <DeleteOutlinedIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Avatar sx={{
                        width: 28, height: 28, fontSize: 11, fontWeight: 700,
                        bgcolor: c.id === activeChatId ? alpha("#2563EB", 0.15) : alpha("#2563EB", 0.06),
                        color: c.id === activeChatId ? "primary.main" : "text.secondary",
                        border: c.id === activeChatId ? `1px solid ${alpha("#2563EB", 0.35)}` : "1px solid transparent",
                      }}>
                        <ChatBubbleOutlinedIcon sx={{ fontSize: 13 }} />
                      </Avatar>
                    )}
                  </ListItemButton>
                </Tooltip>
              ))}
            </List>
            </Box>{/* end scrollable body */}
          </Box>

        </Box>

        {/* ── MAIN ── */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* AppBar */}
          <AppBar position="static" elevation={0} sx={{
            bgcolor: "background.paper",
            borderBottom: `1px solid ${border}`,
            color: "text.primary",
          }}>
            <Toolbar sx={{ minHeight: "56px !important", px: "24px !important", justifyContent: "space-between" }}>
              {/* Left — brand appears here only when sidebar is collapsed */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, overflow: "hidden" }}>
                <Box sx={{
                  display: "flex", alignItems: "center", gap: 1,
                  overflow: "hidden", whiteSpace: "nowrap",
                  opacity: sidebarOpen ? 0 : 1,
                  maxWidth: sidebarOpen ? 0 : 220,
                  transition: "opacity 0.2s, max-width 0.25s cubic-bezier(0.4,0,0.2,1)",
                }}>
                  <Avatar sx={{
                    width: 28, height: 28, borderRadius: "8px", flexShrink: 0,
                    background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                    boxShadow: "0 0 10px rgba(37,99,235,.2)",
                  }}>
                    <SchoolIcon sx={{ fontSize: 15 }} />
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: "-.02em", lineHeight: 1.2 }}>
                      PSG Tech AI
                    </Typography>
                    <Typography sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1 }}>
                      College Assistant
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Right */}
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
                  <IconButton onClick={toggleMode} size="small" sx={{ border: `1px solid ${border}`, borderRadius: "8px", p: 0.75, color: "text.secondary" }}>
                    {mode === "dark" ? <LightModeOutlinedIcon sx={{ fontSize: 17 }} /> : <DarkModeOutlinedIcon sx={{ fontSize: 17 }} />}
                  </IconButton>
                </Tooltip>

                {/* User Menu Button */}
                <Button
                  onClick={(e) => setAnchorEl(e.currentTarget)}
                  endIcon={
                    <KeyboardArrowDownIcon sx={{
                      fontSize: "16px !important", transition: "transform .2s",
                      transform: menuOpen ? "rotate(180deg)" : "none",
                    }} />
                  }
                  sx={{
                    gap: 0.75, px: 1.25, py: 0.5, borderRadius: "10px",
                    border: `1px solid ${border}`, color: "text.primary",
                    "&:hover": { bgcolor: alpha("#2563EB", 0.06), borderColor: "primary.main" },
                  }}
                >
                  <Avatar sx={{ width: 26, height: 26, fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg,#1D4ED8,#3B82F6)" }}>K</Avatar>
                  <Typography sx={{ fontSize: 13, fontWeight: 600 }}>Admin</Typography>
                </Button>

                {/* Dropdown — MUI Menu handles click-away automatically */}
                <Menu
                  anchorEl={anchorEl}
                  open={menuOpen}
                  onClose={() => setAnchorEl(null)}
                  transformOrigin={{ horizontal: "right", vertical: "top" }}
                  anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                  slotProps={{
                    paper: {
                      elevation: 4,
                      sx: { mt: 0.75, minWidth: 200, borderRadius: "12px", border: `1px solid ${border}` },
                    },
                  }}
                >
                  <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Avatar sx={{ width: 34, height: 34, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#1D4ED8,#3B82F6)" }}>K</Avatar>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>Admin</Typography>
                      <Typography sx={{ fontSize: 11, color: "text.secondary" }}>Administrator</Typography>
                    </Box>
                  </Box>
                  <Divider />
                  <MenuItem onClick={handleLogout} sx={{ py: 1, mx: 0.5, borderRadius: "8px", mt: 0.5, mb: 0.5 }}>
                    <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: "error.main" }} /></ListItemIcon>
                    <Typography sx={{ fontSize: 13, color: "error.main" }}>Sign Out</Typography>
                  </MenuItem>
                </Menu>
              </Box>
            </Toolbar>
          </AppBar>

          {/* ── WELCOME PAGE ── */}
          {!hasMessages && (
            <Box sx={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: "40px 28px 24px", gap: 4 }}>
              {/* Hero */}
              <Box sx={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 1.75 }}>
                <Avatar sx={{
                  width: 72, height: 72, borderRadius: "22px",
                  background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", mb: 0.5,
                  boxShadow: "0 12px 40px rgba(37,99,235,.3), 0 0 0 1px rgba(37,99,235,.2)",
                }}>
                  <SchoolIcon sx={{ fontSize: 34 }} />
                </Avatar>
                <Typography sx={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1.2 }}>
                  What do you want to{" "}
                  <Box component="span" sx={{ background: "linear-gradient(90deg,#1D4ED8,#3B82F6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    know today?
                  </Box>
                </Typography>
                <Typography sx={{ fontSize: 14, color: "text.secondary", maxWidth: 340, lineHeight: 1.6 }}>
                  Ask about faculty, exam dates, college events — all answered instantly.
                </Typography>
              </Box>

              {/* Cards */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1.5, width: "100%", maxWidth: 680 }}>
                {CARDS.map(({ Icon, title, desc }) => (
                  <Card key={title} elevation={0} sx={{ border: `1px solid ${border}`, borderRadius: "14px" }}>
                    <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1, p: "18px 16px !important" }}>
                      <Avatar sx={{ width: 36, height: 36, borderRadius: "10px", bgcolor: alpha("#2563EB", 0.08), color: "primary.main", border: `1px solid ${alpha("#2563EB", 0.15)}` }}>
                        <Icon />
                      </Avatar>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-.02em" }}>{title}</Typography>
                      <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.5 }}>{desc}</Typography>
                    </CardContent>
                  </Card>
                ))}
              </Box>

              {/* Chips */}
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, width: "100%" }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "text.disabled" }}>
                  Try asking
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, justifyContent: "center", maxWidth: 580 }}>
                  {CHIPS.map(chip => (
                    <Chip
                      key={chip} label={chip} variant="outlined" clickable
                      onClick={() => handleSend(chip)}
                      sx={{ fontSize: 12.5, "&:hover": { bgcolor: alpha("#2563EB", 0.06), borderColor: "primary.main", color: "primary.main" } }}
                    />
                  ))}
                </Box>
              </Box>

              {/* Input */}
              <Box sx={{ width: "100%", maxWidth: 640 }}>
                <TextField
                  fullWidth
                  placeholder="Ask something about PSG Tech…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSend()}
                  slotProps={{
                    input: {
                      sx: { borderRadius: "13px", fontSize: 14, pr: 0.75 },
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => handleSend()} size="small" sx={{
                            background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                            color: "#fff", borderRadius: "8px", p: 0.75,
                            "&:hover": { opacity: 0.88 },
                          }}>
                            <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                <Typography sx={{ textAlign: "center", fontSize: 11, color: "text.disabled", mt: 1 }}>
                  Press Enter to send · Powered by Mistral
                </Typography>
              </Box>
            </Box>
          )}

          {/* ── CONVERSATION PAGE ── */}
          {hasMessages && (
            <>
              <Box sx={{ flex: 1, overflowY: "auto", p: "32px 28px" }}>
                <Box sx={{ maxWidth: 700, mx: "auto", display: "flex", flexDirection: "column", gap: 2.75 }}>
                  {activeChat.messages.map((msg, i) => (
                    <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                      {msg.role === "bot" && (
                        <Avatar sx={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", fontSize: 12, mt: 0.25 }}>
                          <AutoAwesomeIcon sx={{ fontSize: 13 }} />
                        </Avatar>
                      )}
                      <Box>
                        <Paper elevation={0} sx={{
                          maxWidth: 540, px: 2, py: 1.375,
                          borderRadius: msg.role === "user" ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
                          fontSize: 14, lineHeight: 1.75, letterSpacing: "-.01em", whiteSpace: "pre-wrap",
                          ...(msg.role === "user"
                            ? { background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", color: "#fff", boxShadow: "0 4px 20px rgba(37,99,235,.3)" }
                            : { bgcolor: "background.paper", border: `1px solid ${border}` }
                          ),
                        }}>
                          {msg.content}
                        </Paper>
                        {msg.role === "bot" && msg.route && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.625, pl: 0.25 }}>
                            <Chip
                              icon={<DescriptionOutlinedIcon sx={{ fontSize: "12px !important" }} />}
                              label={msg.route}
                              size="small"
                              sx={{ bgcolor: alpha("#2563EB", 0.08), color: "primary.main", fontWeight: 600, fontSize: 10, height: 20 }}
                            />
                            <Typography sx={{ fontSize: 10.5, color: "text.disabled" }}>just now</Typography>
                          </Box>
                        )}
                      </Box>
                      {msg.role === "user" && (
                        <Avatar sx={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", fontSize: 12, mt: 0.25 }}>
                          <PersonOutlinedIcon sx={{ fontSize: 15 }} />
                        </Avatar>
                      )}
                    </Box>
                  ))}

                  {msgsLoading && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Avatar sx={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", mt: 0.25 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 13 }} />
                      </Avatar>
                      <Paper elevation={0} sx={{
                        px: 2, py: 1.5, borderRadius: "3px 14px 14px 14px",
                        bgcolor: "background.paper", border: `1px solid ${border}`,
                        display: "flex", gap: 0.625, alignItems: "center",
                      }}>
                        {[0, 1, 2].map(i => (
                          <Box key={i} sx={{
                            width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", opacity: 0.4,
                            animation: "blink 1.3s infinite ease-in-out",
                            animationDelay: `${i * 0.18}s`,
                            "@keyframes blink": { "0%,80%,100%": { opacity: 0.4, transform: "scale(1)" }, "40%": { opacity: 1, transform: "scale(1.25)" } },
                          }} />
                        ))}
                      </Paper>
                    </Box>
                  )}

                  {loading && (
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
                      <Avatar sx={{ width: 28, height: 28, borderRadius: "8px", background: "linear-gradient(135deg,#1D4ED8,#3B82F6)", mt: 0.25 }}>
                        <AutoAwesomeIcon sx={{ fontSize: 13 }} />
                      </Avatar>
                      <Paper elevation={0} sx={{
                        px: 2, py: 1.5, borderRadius: "3px 14px 14px 14px",
                        bgcolor: "background.paper", border: `1px solid ${border}`,
                        display: "flex", gap: 0.625, alignItems: "center",
                      }}>
                        {[0, 1, 2].map(i => (
                          <Box key={i} sx={{
                            width: 6, height: 6, borderRadius: "50%", bgcolor: "primary.main", opacity: 0.4,
                            animation: "blink 1.3s infinite ease-in-out",
                            animationDelay: `${i * 0.18}s`,
                            "@keyframes blink": { "0%,80%,100%": { opacity: 0.4, transform: "scale(1)" }, "40%": { opacity: 1, transform: "scale(1.25)" } },
                          }} />
                        ))}
                      </Paper>
                    </Box>
                  )}
                  <Box ref={bottomRef} />
                </Box>
              </Box>

              {/* Input */}
              <Paper elevation={0} sx={{ p: "13px 28px 17px", borderRadius: 0, bgcolor: "background.default" }}>
                <Box sx={{ maxWidth: 700, mx: "auto" }}>
                  <TextField
                    fullWidth
                    placeholder="Ask something about PSG Tech…"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSend()}
                    slotProps={{
                      input: {
                        sx: { borderRadius: "13px", fontSize: 14, pr: 0.75 },
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton onClick={() => handleSend()} size="small" sx={{
                              background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
                              color: "#fff", borderRadius: "8px", p: 0.75,
                              "&:hover": { opacity: 0.88 },
                            }}>
                              <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                  <Typography sx={{ textAlign: "center", fontSize: 11, color: "text.disabled", mt: 1 }}>
                    Press Enter to send · Powered by Mistral
                  </Typography>
                </Box>
              </Paper>
            </>
          )}
        </Box>
      </Box>
      {/* ── RENAME DIALOG ── */}
      <Dialog
        open={renameDialog.open}
        onClose={() => setRenameDialog({ open: false, id: null, value: "" })}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              border: `1px solid ${border}`,
              boxShadow: "0 16px 48px rgba(0,0,0,.3)",
              minWidth: 360,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>
          Rename Chat
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="Chat name"
            value={renameDialog.value}
            onChange={e => setRenameDialog(d => ({ ...d, value: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submitRename()}
            slotProps={{ input: { sx: { borderRadius: "10px", fontSize: 14 } } }}
            sx={{ mt: 0.5 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            size="small"
            onClick={() => setRenameDialog({ open: false, id: null, value: "" })}
            sx={{ borderRadius: "8px", color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!renameDialog.value.trim()}
            onClick={submitRename}
            sx={{
              borderRadius: "8px",
              background: "linear-gradient(135deg,#1D4ED8,#3B82F6)",
              boxShadow: "none",
              "&:hover": { opacity: 0.9, boxShadow: "none" },
            }}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── DELETE DIALOG ── */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null, title: "" })}
        slotProps={{
          paper: {
            sx: {
              borderRadius: "16px",
              border: `1px solid ${border}`,
              boxShadow: "0 16px 48px rgba(0,0,0,.3)",
              minWidth: 360,
            },
          },
        }}
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700, pb: 1 }}>
          Delete Chat
        </DialogTitle>
        <DialogContent sx={{ pb: 1 }}>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", lineHeight: 1.6 }}>
            Delete <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>“{deleteDialog.title}”</Box>? This will remove all of its messages and can't be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            size="small"
            onClick={() => setDeleteDialog({ open: false, id: null, title: "" })}
            sx={{ borderRadius: "8px", color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={confirmDelete}
            sx={{ borderRadius: "8px", boxShadow: "none", "&:hover": { opacity: 0.9, boxShadow: "none" } }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

    </ThemeProvider>
  );
}
