import { useState, useEffect } from "react";
import { GraduationCap } from "lucide-react";

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [chats, setChats] = useState([
    { id: 1, title: "New Chat", messages: [] }
  ]);
  const [activeChatId, setActiveChatId] = useState(1);

  const activeChat = chats.find(chat => chat.id === activeChatId);

  // Theme load
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") setDarkMode(true);
  }, []);

  // Theme apply
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const updateMessages = (newMessage) => {
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChatId
          ? { ...chat, messages: [...chat.messages, newMessage] }
          : chat
      )
    );
  };

  const handleSend = async () => {
    if (!message.trim()) return;

    updateMessages({ role: "user", content: message });

    const currentMessage = message;
    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: currentMessage }),
      });

      const data = await res.json();

      updateMessages({
        role: "bot",
        content: data.answer || "No response",
      });
    } catch {
      updateMessages({
        role: "bot",
        content: "Error connecting to server",
      });
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = () => {
    const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [],
    };
    setChats((prev) => [...prev, newChat]);
    setActiveChatId(newChat.id);
  };

  const renameChat = (id) => {
    const newTitle = prompt("Enter new chat name:");
    if (!newTitle?.trim()) return;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === id ? { ...chat, title: newTitle } : chat
      )
    );
  };

  if (!activeChat) return null;

  return (
    <div className="bg-white dark:bg-[#0D0D0F] text-black dark:text-[#E4E4E7] min-h-screen flex">

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-gray-200 dark:bg-[#111113] border-r border-transparent dark:border-[#1C1C1F] p-6">
        
        <h2 className="text-[13px] font-semibold tracking-wide text-black dark:text-[#A1A1AA] mb-6 flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#FF4D4F]" />
          ACADEMIC VAULT
        </h2>

        <button
          onClick={createNewChat}
          className="text-[14px] font-medium bg-red-500 dark:bg-gradient-to-r dark:from-[#FF4D4F] dark:to-[#B91C1C] text-white px-4 py-2 rounded-lg mb-4"
        >
          + New Chat
        </button>

        <div className="flex flex-col gap-2">
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`flex justify-between items-center px-3 py-2 rounded cursor-pointer ${
                chat.id === activeChatId
                  ? "bg-red-500 text-white dark:bg-[#1A1A1D]"
                  : "bg-gray-300 dark:bg-transparent dark:hover:bg-[#18181B]"
              }`}
            >
              <span className="truncate text-[14px] text-black dark:text-[#D4D4D8]">
                {chat.title}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  renameChat(chat.id);
                }}
                className="text-xs text-gray-700 dark:text-[#71717A]"
              >
                ✏️
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col">

        {/* Header */}
        <header className="flex justify-between items-center px-6 py-4 bg-gray-100 dark:bg-[#0D0D0F] border-b border-gray-200 dark:border-[#1C1C1F]">
          
          <div className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#FF4D4F]" />
            <h1 className="text-[18px] font-semibold tracking-tight text-black dark:text-[#E4E4E7]">
              PSG Tech AI
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode((prev) => !prev)}
              className="text-[14px] px-3 py-1 rounded bg-gray-300 dark:bg-[#18181B] text-black dark:text-[#D4D4D8]"
            >
              {darkMode ? "☀️ Light" : "🌙 Dark"}
            </button>

            <div className="w-8 h-8 bg-gray-400 dark:bg-[#18181B] rounded-full"></div>
          </div>
        </header>

        {/* Chat */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-3xl mx-auto flex flex-col gap-4">

            {activeChat.messages.length === 0 && (
              <p className="text-[13px] text-center text-gray-500 dark:text-[#71717A]">
                Ask anything about PSG Tech
              </p>
            )}

            {activeChat.messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "user" ? (
                  <div className="px-5 py-3 rounded-2xl max-w-md bg-red-500 text-white dark:bg-[#2A2A2E] dark:text-[#F4F4F5] text-[14.5px] leading-[1.6]">
                    {msg.content}
                  </div>
                ) : (
                  <div className="relative px-5 py-4 rounded-2xl max-w-md 
                    bg-gray-200 dark:bg-[#18181B] 
                    border border-gray-300 dark:border-[#2A2A2E]
                    text-black dark:text-[#D4D4D8]
                    text-[14.5px] leading-[1.7]
                    shadow-[0_0_0_1px_rgba(255,77,79,0.15),0_0_25px_rgba(255,77,79,0.08)]">
                    
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="text-[13px] text-gray-500 dark:text-[#71717A]">
                Thinking...
              </div>
            )}

          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-[#1C1C1F]">
          <div className="flex items-center bg-gray-100 dark:bg-[#18181B] border border-gray-300 dark:border-[#2A2A2E] rounded-full px-3 h-[48px]">
            
            <input
             className="flex-1 bg-transparent outline-none px-2 text-[14px]"
              placeholder="Ask something..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />

            <button
              onClick={handleSend}
              className="text-[13.5px] font-medium bg-red-500 dark:bg-gradient-to-r dark:from-[#FF4D4F] dark:to-[#B91C1C] text-white px-4 py-1.5 rounded-full"
            >
              ↑
            </button>

          </div>
        </div>

      </main>
    </div>
  );
}