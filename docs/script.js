document.getElementById('send-button').addEventListener('click', function() {
    sendMessage();
});

document.getElementById('message-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

function sendMessage() {
    const input = document.getElementById('message-input');
    const messageText = input.value.trim();

    if (messageText) {
        // Add user's message 
        addMessage('user', 'User', 'user-avatar.png', messageText);

        // Clear the input field
        input.value = '';

        // response after a short delay
        setTimeout(function() {
            addMessage('system', 'AI Assistant', 'system-avatar.png', "I am a simple bot. I don't have real responses yet!");
        }, 500);
    }
}

function addMessage(sender, name, profileImage, text) {
    const chatHistory = document.getElementById('chat-history');

    const message = document.createElement('div');
    message.className = `message ${sender}`;

    const profileImg = document.createElement('img');
    profileImg.src = profileImage;
    profileImg.className = 'profile-img';

    const messageContent = document.createElement('div');

    const nameElement = document.createElement('div');
    nameElement.className = 'name';
    nameElement.textContent = name;

    const textElement = document.createElement('div');
    textElement.className = 'text';
    textElement.innerHTML = text;

    messageContent.appendChild(nameElement);
    messageContent.appendChild(textElement);

    message.appendChild(profileImg);
    message.appendChild(messageContent);

    chatHistory.appendChild(message);

    // Scroll to the bottom of the chat history
    chatHistory.scrollTop = chatHistory.scrollHeight;
}
