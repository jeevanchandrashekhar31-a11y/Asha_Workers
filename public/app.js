document.addEventListener('DOMContentLoaded', () => {
  const recordBtn = document.getElementById('recordBtn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');
  const jsonOutput = document.getElementById('jsonOutput');
  const visitTypeSelect = document.getElementById('visitType');
  const historyListEl = document.getElementById('historyList');

  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = "Stop Recording";
      recordBtn.classList.replace('primary', 'danger');
      statusEl.textContent = "Recording...";
      statusEl.classList.add('recording');
    } catch (err) {
      console.error("Error accessing microphone:", err);
      statusEl.textContent = "Error: Cannot access microphone";
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    isRecording = false;
    recordBtn.textContent = "Start Recording";
    recordBtn.classList.replace('danger', 'primary');
    statusEl.textContent = "Processing audio...";
    statusEl.classList.remove('recording');
  }

  async function handleStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const visitType = visitTypeSelect.value;
    
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('visitType', visitType);

    try {
      const response = await fetch('/api/visits/audio', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Upload failed');
      }

      statusEl.textContent = "Done!";
      resultsEl.classList.remove('hidden');
      jsonOutput.textContent = JSON.stringify(data, null, 2);
      
      // Update history after saving
      fetchAndRenderVisits();
    } catch (error) {
      console.error("Upload error:", error);
      statusEl.textContent = "Error: " + error.message;
    }
  }

  function formatRelativeTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.round(diffMs / 1000);
    const diffMins = Math.round(diffSecs / 60);
    const diffHours = Math.round(diffMins / 60);
    const diffDays = Math.round(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }

  function formatVisitType(typeStr) {
    return typeStr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async function fetchAndRenderVisits() {
    try {
      const response = await fetch('/api/visits');
      if (!response.ok) throw new Error("Failed to fetch visits");
      let visits = await response.json();
      
      // Sort newest first client-side (fallback)
      visits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      if (visits.length === 0) {
        historyListEl.innerHTML = `
          <div class="empty-state">
            <p>No visits logged yet — record your first one above!</p>
          </div>
        `;
        return;
      }

      historyListEl.innerHTML = '';
      
      visits.forEach(visit => {
        const isComplete = visit.status === 'complete';
        
        const card = document.createElement('div');
        card.className = 'visit-card';
        
        // Header
        const header = document.createElement('div');
        header.className = 'visit-header';
        
        const titleContainer = document.createElement('div');
        const title = document.createElement('h3');
        title.className = 'visit-title';
        title.textContent = formatVisitType(visit.visitType || visit.visit_type || 'General Visit');
        
        const time = document.createElement('div');
        time.className = 'visit-time';
        time.textContent = formatRelativeTime(visit.timestamp);
        
        titleContainer.appendChild(title);
        titleContainer.appendChild(time);
        
        const pill = document.createElement('span');
        pill.className = `pill ${isComplete ? 'complete' : 'incomplete'}`;
        pill.textContent = isComplete ? 'Complete' : 'Incomplete';
        
        header.appendChild(titleContainer);
        header.appendChild(pill);
        card.appendChild(header);
        
        // Transcript
        if (visit.transcript) {
          const transcriptEl = document.createElement('div');
          transcriptEl.className = 'visit-transcript clickable';
          
          const fullText = visit.transcript;
          const isLong = fullText.length > 100;
          const truncated = isLong ? fullText.substring(0, 100) + '...' : fullText;
          
          transcriptEl.textContent = truncated;
          
          if (isLong) {
            transcriptEl.addEventListener('click', () => {
              if (transcriptEl.textContent === truncated) {
                transcriptEl.textContent = fullText;
              } else {
                transcriptEl.textContent = truncated;
              }
            });
          } else {
            transcriptEl.classList.remove('clickable');
          }
          card.appendChild(transcriptEl);
        }
        
        // Extracted Fields Chips
        if (visit.extracted_fields && Object.keys(visit.extracted_fields).length > 0) {
          const chipsContainer = document.createElement('div');
          chipsContainer.className = 'chips-container';
          
          Object.entries(visit.extracted_fields).forEach(([key, value]) => {
            if (value !== null && value !== '') {
              const chip = document.createElement('span');
              chip.className = 'chip';
              const formattedKey = formatVisitType(key);
              chip.textContent = `${formattedKey}: ${value}`;
              chipsContainer.appendChild(chip);
            }
          });
          card.appendChild(chipsContainer);
        }
        
        // Missing Fields
        if (!isComplete && visit.missing_fields && visit.missing_fields.length > 0) {
          const missingEl = document.createElement('div');
          missingEl.className = 'missing-fields';
          const missingNames = visit.missing_fields.map(formatVisitType).join(', ');
          missingEl.textContent = `Missing: ${missingNames}`;
          card.appendChild(missingEl);
        }
        
        historyListEl.appendChild(card);
      });
      
    } catch (error) {
      console.error("Error fetching visits:", error);
      historyListEl.innerHTML = `<p style="color:red">Error loading visit history.</p>`;
    }
  }

  // Initial load
  fetchAndRenderVisits();
});
