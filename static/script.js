document.addEventListener('DOMContentLoaded', function () {
    let csvUploaded = false; // Track if a CSV file has been uploaded
    let isTableVisible = true; // Track if table is visible or not
    let fileData = null; // Track the uploaded CSV file

    // Drag and Drop functionality for the entire drop area
    const dropArea = document.getElementById('drop-area');

    dropArea.addEventListener('dragover', function (e) {
        e.preventDefault(); // Prevent default behavior
        dropArea.classList.add('dragover'); // Highlight the drop area
    });

    dropArea.addEventListener('dragleave', function () {
        dropArea.classList.remove('dragover'); // Remove highlight
    });

    dropArea.addEventListener('drop', function (e) {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        handleFileUpload(file); // Process the dropped file
    });

    // Upload button click
    document.getElementById('upload-button').addEventListener('click', function () {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        handleFileUpload(file);
    });

    // Handle file upload, CSV parsing, and error handling
    function handleFileUpload(file) {
        const errorDiv = document.getElementById('error-message');
        if (!file || file.type !== 'text/csv') {
            errorDiv.textContent = "Error: Please upload a CSV file.";
            return;
        }

        fileData = file; // Save the file for later upload
        const reader = new FileReader();
        reader.onload = function (e) {
            const text = e.target.result;

            // Parse the CSV file using d3.csvParse
            const data = d3.csvParse(text);

            // Display the first 15 rows of the parsed data in a table
            displayTablePreview(data.slice(0, 9));

            csvUploaded = true; // Mark that a CSV file has been successfully uploaded
            uploadCSVFile(); // Automatically upload the CSV to the backend
        };
        reader.readAsText(file);
    }

    // Function to upload the CSV file to the backend
    async function uploadCSVFile() {
        if (!fileData) {
            console.log('No file to upload');
            return;
        }

        const formData = new FormData();
        formData.append('file', fileData); // Append the file to the form data

        try {
            const response = await fetch('/upload-data', {
                method: 'POST',
                body: formData // Send the file as form data
            });

            if (response.ok) {
                const data = await response.json();
                console.log('CSV uploaded successfully. Data:', data);
                // Optionally: display metadata or give feedback to the user
            } else {
                console.log('Failed to upload CSV');
            }
        } catch (error) {
            console.log('Error uploading CSV:', error);
        }
    }

    // Display table preview with parsed CSV data
    function displayTablePreview(data) {
        const tableDiv = document.getElementById('table-preview');
        tableDiv.innerHTML = '';  // Clear previous content

        if (!data.length) {
            tableDiv.textContent = "No data available.";
            return;
        }

        let tableHTML = '<table><thead><tr>';

        // Add table headers (using the keys from the first row of data)
        Object.keys(data[0]).forEach(col => {
            tableHTML += `<th>${col}</th>`;
        });
        tableHTML += '</tr></thead><tbody>';

        // Add table rows (loop through each row in data)
        data.forEach(row => {
            tableHTML += '<tr>';
            Object.values(row).forEach(cell => {
                tableHTML += `<td>${cell}</td>`;
            });
            tableHTML += '</tr>';
        });
        tableHTML += '</tbody></table>';

        tableDiv.innerHTML = tableHTML;  // Display the table in the preview area

        // Show the toggle button once the table is displayed
        const toggleButton = document.getElementById('toggle-table-preview');
        toggleButton.style.display = 'inline-block';
        toggleButton.textContent = 'Hide Table Preview';
        isTableVisible = true;

        // Attach the event listener here since the button is now visible
        toggleButton.addEventListener('click', toggleTableVisibility);
    }

    // Toggle table visibility function
    function toggleTableVisibility() {
        const tableDiv = document.getElementById('table-preview');
        const toggleButton = document.getElementById('toggle-table-preview');

        if (isTableVisible) {
            tableDiv.style.display = 'none'; // Hide the table
            toggleButton.textContent = 'Show Table Preview';
        } else {
            tableDiv.style.display = 'block'; // Show the table
            toggleButton.textContent = 'Hide Table Preview';
        }
        isTableVisible = !isTableVisible; // Toggle the visibility flag
    }

    // Handle chat message sending
    document.getElementById('send-button').addEventListener('click', sendMessage);

    // Enable Enter key to send message
    document.getElementById('message-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    async function sendMessage() {
        const input = document.getElementById('message-input');
        const messageText = input.value.trim();
    
        if (messageText) {
            // Add user's message to the chat
            addMessage('user', 'User', '/static/user-avatar.png', messageText);
    
            // Clear the input field
            input.value = '';
    
            // If a CSV has not been uploaded, notify the user
            if (!csvUploaded) {
                addMessage('system', 'AI Assistant', '/static/system-avatar.png', 'Please upload a CSV file before sending a message.');
                return;
            }
    
            try {
                const response = await fetch('/query', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ prompt: messageText })
                });
    
                if (response.ok) {
                    const data = await response.json();
                    console.log("Response from GPT:", data);
    
                    // Check if the response is related to data visualization
                    if (data.specification && data.description) {
                        // Create a container for the system response
                        const messageContainer = document.createElement('div');
                        messageContainer.className = 'message system';
    
                        // Create elements for avatar and name
                        const profileImg = document.createElement('img');
                        profileImg.src = '/static/system-avatar.png'; // System avatar image
                        profileImg.className = 'profile-img';
    
                        const nameElement = document.createElement('div');
                        nameElement.className = 'name';
                        nameElement.textContent = 'AI Assistant';
    
                        // Create a container for the chart and description
                        const responseContent = document.createElement('div');
                        responseContent.className = 'chart-description-container';
    
                        const chartContainer = document.createElement('div');
                        chartContainer.id = `vis-${Date.now()}`; // Unique ID for each chart
                        chartContainer.style.marginBottom = '10px';
    
                        const descriptionElement = document.createElement('p');
                        descriptionElement.className = 'text';
                        descriptionElement.innerText = data.description;
    
                        // Append the chart and description to the responseContent container
                        responseContent.appendChild(chartContainer);
                        responseContent.appendChild(descriptionElement);
    
                        // Append the system's avatar, name, and responseContent to messageContainer
                        messageContainer.appendChild(profileImg);
                        messageContainer.appendChild(nameElement);
                        messageContainer.appendChild(responseContent);
    
                        // Add the messageContainer to the chat history
                        document.getElementById('chat-history').appendChild(messageContainer);
    
                        // Embed the Vega-Lite visualization using vegaEmbed
                        vegaEmbed(`#${chartContainer.id}`, data.specification)
                            .then(result => {
                                console.log('Vega-Lite visualization embedded successfully!');
                            })
                            .catch(err => {
                                console.error('Error embedding Vega-Lite visualization:', err);
                                addMessage('system', 'AI Assistant', '/static/system-avatar.png', 'Error embedding the visualization.');
                            });
                    } else {
                        // If the response is not related to data visualization, print it directly
                        addMessage('system', 'AI Assistant', '/static/system-avatar.png', data.description || "Request unrelated to data visualization.");
                    }
    
                } else {
                    addMessage('system', 'AI Assistant', '/static/system-avatar.png', 'Error: Could not get response from GPT.');
                }
            } catch (error) {
                addMessage('system', 'AI Assistant', '/static/system-avatar.png', 'Error: Network issue.');
            }
        }
    }
    
    // Helper function to add messages to the chat
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
    
});
