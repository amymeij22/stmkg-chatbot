import ChatbotIcon from "./ChatbotIcon";
import PropTypes from 'prop-types';

const ChatMessage = ({ chat }) => {
  return (
    !chat.hideInChat && (
      <div className={`message ${chat.role === "model" ? "bot" : "user"}-message ${chat.isError ? "error" : ""}`}>
        {chat.role === "model" && <ChatbotIcon />}
        <p className="message-text">{chat.text}</p>
      </div>
    )
  );
};

ChatMessage.propTypes = {
  chat: PropTypes.object.isRequired,
  hideInChat: PropTypes.bool,
};

export default ChatMessage;