document.addEventListener('DOMContentLoaded', () => {
  // --- Tab Elements ---
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  // --- Log Visit Elements ---
  const recordBtn = document.getElementById('recordBtn');
  const statusEl = document.getElementById('status');
  const visitTypeSelect = document.getElementById('visitType');
  const successCard = document.getElementById('successCard');
  const successDetails = document.getElementById('successDetails');

  // --- History Elements ---
  const historyListEl = document.getElementById('historyList');
  const anomalyPlaceholder = document.getElementById('anomalyContainerPlaceholder');

  // --- Digest Elements ---
  const supervisorBtn = document.getElementById('supervisorRefreshBtn');
  const supervisorStatus = document.getElementById('supervisorStatus');
  const supervisorContent = document.getElementById('supervisorContent');

  const phcBtn = document.getElementById('phcRefreshBtn');
  const phcStatus = document.getElementById('phcStatus');
  const phcContent = document.getElementById('phcContent');

  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  // --- Tab Switching Logic ---
  function handleHashChange() {
    let hash = window.location.hash || '#/log';
    
    // Deactivate all
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Find matching button
    let activeBtn = Array.from(tabBtns).find(b => b.getAttribute('href') === hash);
    if (!activeBtn) {
      activeBtn = tabBtns[0]; // fallback to first tab
      hash = activeBtn.getAttribute('href');
    }
    
    // Activate clicked
    activeBtn.classList.add('active');
    const targetId = activeBtn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');

    // Fetch fresh data when switching to specific tabs
    if (targetId === 'tab-history') {
      fetchAndRenderVisits();
      fetchAndRenderAnomalies();
    } else if (targetId === 'tab-supervisor') {
      fetchSupervisorDigest();
    } else if (targetId === 'tab-phc') {
      fetchPhcDigest();
    }
  }

  window.addEventListener('hashchange', handleHashChange);

  // --- Recording Logic ---
  recordBtn.addEventListener('click', async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  async function startRecording() {
    try {
      successCard.style.display = 'none'; // Hide any previous success
      statusEl.textContent = ""; // Clear any previous error
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Brief delay to prevent mic initialization lag from clipping the first word
      await new Promise(resolve => setTimeout(resolve, 400));
      
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
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const pcmData = audioBuffer.getChannelData(0);
      
      let sumSquares = 0;
      for (let i = 0; i < pcmData.length; i++) {
        sumSquares += pcmData[i] * pcmData[i];
      }
      const rms = Math.sqrt(sumSquares / pcmData.length);
      console.log(`Calculated Audio RMS: ${rms}`);
      
      if (rms < 0.01) {
        statusEl.style.display = 'block';
        statusEl.textContent = "Error: Audio too short or empty — please record a longer message.";
        successCard.style.display = 'none';
        return; // Abort upload
      }
    } catch (err) {
      console.warn("Client-side silence check failed or not supported, proceeding with upload.", err);
    }

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

      // Log the full JSON for debugging as requested
      console.log("=== Raw JSON Response ===");
      console.log(JSON.stringify(data, null, 2));
      console.log("=========================");

      statusEl.textContent = "Done!";
      
      // Construct professional success details string
      let beneficiaryName = "Unknown Beneficiary";
      let zoneText = "";
      
      if (data.extracted_fields) {
        beneficiaryName = data.extracted_fields.beneficiary_name || beneficiaryName;
        if (data.extracted_fields.zone) {
          zoneText = ` • ${data.extracted_fields.zone}`;
        }
      }

      const formattedType = formatVisitType(data.visit_type || visitType);
      successDetails.textContent = `${beneficiaryName} • ${formattedType}${zoneText}`;
      successCard.style.display = 'block';
      statusEl.style.display = 'none'; // Hide status text when showing success card
      
      // Also update history in the background so it's ready
      fetchAndRenderVisits();
      fetchAndRenderAnomalies();
      
    } catch (error) {
      console.error("Upload error:", error);
      statusEl.style.display = 'block';
      statusEl.textContent = "Error: " + error.message;
      successCard.style.display = 'none'; // Explicitly hide success card on error
    }
  }

  // --- Utility Functions ---
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
    if (!typeStr) return "Visit";
    return typeStr
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // --- Data Fetching (History & Anomalies) ---
  async function fetchAndRenderVisits() {
    try {
      const response = await fetch('/api/visits');
      if (!response.ok) throw new Error("Failed to fetch visits");
      let visits = await response.json();
      
      visits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      if (visits.length === 0) {
        historyListEl.innerHTML = `
          <div class="empty-state">
            <p>No visits logged yet — record your first one in the Log Visit tab!</p>
          </div>
        `;
        return;
      }

      historyListEl.innerHTML = '';
      
      visits.forEach(visit => {
        const isComplete = visit.status === 'complete';
        const card = document.createElement('div');
        card.className = 'visit-card';
        
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
        
        if (visit.transcript) {
          const transcriptEl = document.createElement('div');
          transcriptEl.className = 'visit-transcript clickable';
          const fullText = visit.transcript;
          const isLong = fullText.length > 100;
          const truncated = isLong ? fullText.substring(0, 100) + '...' : fullText;
          
          transcriptEl.textContent = truncated;
          if (isLong) {
            transcriptEl.addEventListener('click', () => {
              transcriptEl.textContent = transcriptEl.textContent === truncated ? fullText : truncated;
            });
          } else {
            transcriptEl.classList.remove('clickable');
          }
          card.appendChild(transcriptEl);
        }
        
        if (visit.extracted_fields && Object.keys(visit.extracted_fields).length > 0) {
          const chipsContainer = document.createElement('div');
          chipsContainer.className = 'chips-container';
          
          Object.entries(visit.extracted_fields).forEach(([key, value]) => {
            if (value !== null && value !== '') {
              const chip = document.createElement('span');
              chip.className = 'chip';
              chip.textContent = `${formatVisitType(key)}: ${value}`;
              chipsContainer.appendChild(chip);
            }
          });
          card.appendChild(chipsContainer);
        }
        
        if (!isComplete && visit.missing_fields && visit.missing_fields.length > 0) {
          const missingEl = document.createElement('div');
          missingEl.className = 'missing-fields';
          missingEl.textContent = `Missing: ${visit.missing_fields.map(formatVisitType).join(', ')}`;
          card.appendChild(missingEl);
        }
        
        historyListEl.appendChild(card);
      });
      
    } catch (error) {
      console.error("Error fetching visits:", error);
      historyListEl.innerHTML = `<p style="color:red">Error loading visit history.</p>`;
    }
  }

  async function fetchAndRenderAnomalies() {
    try {
      const response = await fetch('/api/anomalies');
      if (!response.ok) return;
      
      const data = await response.json();
      
      let anomalyContainer = document.getElementById('anomalyContainer');
      if (anomalyContainer) {
        anomalyContainer.remove();
      }

      if (data.anomalyCount > 0) {
        anomalyContainer = document.createElement('div');
        anomalyContainer.id = 'anomalyContainer';
        anomalyPlaceholder.parentNode.insertBefore(anomalyContainer, anomalyPlaceholder);
        
        const title = document.createElement('h3');
        title.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 0.5rem;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>Detected Anomalies';
        anomalyContainer.appendChild(title);
        
        data.anomalies.forEach(anomaly => {
          const item = document.createElement('div');
          item.className = 'anomaly-card';
          item.textContent = anomaly.reason;
          anomalyContainer.appendChild(item);
        });
      }
    } catch (error) {
      console.error("Error fetching anomalies:", error);
    }
  }

  // --- Digest Logic ---
  function parseMarkdownToHTML(text) {
    if (!text) return "";
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return html;
  }

  async function fetchSupervisorDigest() {
    try {
      supervisorStatus.textContent = "Loading digest...";
      supervisorStatus.style.display = 'block';
      supervisorContent.style.display = 'none';
      if (supervisorBtn) supervisorBtn.disabled = true;
      
      const response = await fetch('/api/supervisor-digest');
      const data = await response.json();
      
      if (!response.ok) throw new Error('Failed to fetch digest');
      
      supervisorStatus.style.display = 'none';
      supervisorContent.innerHTML = parseMarkdownToHTML(data.digest);
      supervisorContent.style.display = 'block';
    } catch (err) {
      console.error(err);
      supervisorStatus.textContent = "Unable to load supervisor digest at this time. Please try again.";
      supervisorStatus.style.display = 'block';
      supervisorContent.style.display = 'none';
    } finally {
      if (supervisorBtn) supervisorBtn.disabled = false;
    }
  }

  async function fetchPhcDigest() {
    try {
      phcStatus.textContent = "Loading digest...";
      phcStatus.style.display = 'block';
      phcContent.style.display = 'none';
      if (phcBtn) phcBtn.disabled = true;
      
      const response = await fetch('/api/phc-digest');
      const data = await response.json();
      
      if (!response.ok) throw new Error('Failed to fetch digest');
      
      phcStatus.style.display = 'none';
      phcContent.innerHTML = parseMarkdownToHTML(data.digest);
      phcContent.style.display = 'block';
    } catch (err) {
      console.error(err);
      phcStatus.textContent = "Unable to load PHC zone digest at this time. Please try again.";
      phcStatus.style.display = 'block';
      phcContent.style.display = 'none';
    } finally {
      if (phcBtn) phcBtn.disabled = false;
    }
  }

  if (supervisorBtn) supervisorBtn.addEventListener('click', fetchSupervisorDigest);
  if (phcBtn) phcBtn.addEventListener('click', fetchPhcDigest);

  // Initial load
  handleHashChange();
});
