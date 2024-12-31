import { useEffect, useRef, useState } from "react";
import { RiMessage3Line } from 'react-icons/ri';
import ChatbotIcon from "./components/ChatbotIcon";
import ChatForm from "./components/ChatForm";
import ChatMessage from "./components/ChatMessage";
import { companyInfo } from "./companyInfo";

const App = () => {
  const chatBodyRef = useRef();
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatHistory, setChatHistory] = useState([
    {
      hideInChat: true,
      role: "model",
      text: companyInfo,
    },
  ]);

  const generateBotResponse = async (history) => {
    const updateHistory = (text, isError = false) => {
      setChatHistory((prev) => [...prev.filter((msg) => msg.text !== ""), { role: "model", text, isError }]);
    };

    history = history.map(({ role, text }) => ({ role, parts: [{ text }] }));

    const requestOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: history }),
    };

    try {
      const response = await fetch(import.meta.env.VITE_API_URL, requestOptions);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error.message || "Something went wrong!");

      const apiResponseText = data.candidates[0].content.parts[0].text.replace(/\*\*(.*?)\*\*/g, "$1").trim();
      updateHistory(apiResponseText);
    } catch (error) {
      updateHistory(error.message, true);
    }
  };

  const refreshChat = () => {
    setChatHistory([
      {
        hideInChat: true,
        role: "model",
        text: companyInfo,
      },
    ]);
  };

  useEffect(() => {
    chatBodyRef.current.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: "smooth" });
  }, [chatHistory]);

  return (
    <div className={`container ${showChatbot ? "show-chatbot" : ""}`}>
      <button onClick={() => {
        setShowChatbot((prev) => !prev);
      }} id="chatbot-toggler">
        {showChatbot ? (
          <span className="material-icons">keyboard_arrow_up</span>
        ) : (
          <RiMessage3Line size={25} style={{ color: 'white' }} />
        )}
      </button>

      <div className="chatbot-popup">
        <div className="chat-header">
          <div className="header-info">
            <ChatbotIcon />
            <h2 className="logo-text">STMKG Chatbot Assistant</h2>
          </div>
          <button 
            onClick={refreshChat} 
            className="material-icons" 
            title="Refresh Chat" 
            style={{ fontSize: '21px', minWidth: '30px', minHeight: '30px' }}
          >
            refresh
          </button>
          <button onClick={() => {
            setShowChatbot((prev) => !prev);
          }} className="material-icons">
            keyboard_arrow_down
          </button>
        </div>

        <div ref={chatBodyRef} className="chat-body">
          <div className="message bot-message">
            <ChatbotIcon />
            <p className="message-text">
              Halo, Saya adalah Asisten Chatbot dari Sekolah Tinggi Meteorologi Klimatologi dan Geofisika 
              <br /> Ada yang bisa saya bantu?
            </p>
          </div>

          {chatHistory.map((chat, index) => (
            <ChatMessage key={index} chat={chat} hideInChat={chat.hideInChat !== undefined ? chat.hideInChat : false} />
          ))}
        </div>

        <div className="chat-footer">
          <ChatForm chatHistory={chatHistory} setChatHistory={setChatHistory} generateBotResponse={generateBotResponse} />
        </div>
      </div>
    </div>
  );
};

export default App;