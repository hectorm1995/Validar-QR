// QR Validator App - Main JavaScript
// Handles QR scanning, validation, and UI updates

class QRValidatorApp {
    constructor() {
        this.html5QrCode = null;
        this.apiUrl = localStorage.getItem('apiUrl') || '';
        this.statsInterval = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadGlobalStats();

        // Auto-refresh stats every 10 seconds
        this.statsInterval = setInterval(() => this.loadGlobalStats(), 10000);

        // Show settings modal if API URL not configured
        if (!this.apiUrl) {
            this.showSettingsModal();
        }
    }

    setupEventListeners() {
        document.getElementById('start-scan-btn').addEventListener('click', () => this.startScanning());
        document.getElementById('stop-scan-btn').addEventListener('click', () => this.stopScanning());
        document.getElementById('scan-again-btn').addEventListener('click', () => this.resetToScanner());
        document.getElementById('settings-btn').addEventListener('click', () => this.showSettingsModal());
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('close-modal-btn').addEventListener('click', () => this.closeSettingsModal());
        document.getElementById('refresh-stats-btn').addEventListener('click', () => this.loadGlobalStats());
    }

    async startScanning() {
        try {
            this.html5QrCode = new Html5Qrcode("reader");

            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => this.onScanSuccess(decodedText),
                (errorMessage) => { } // Ignore scan errors
            );

            document.getElementById('start-scan-btn').style.display = 'none';
            document.getElementById('stop-scan-btn').style.display = 'flex';

        } catch (err) {
            console.error('Error starting scanner:', err);
            alert('Error al iniciar la cámara. Por favor, permite el acceso a la cámara.');
        }
    }

    async stopScanning() {
        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                this.html5QrCode.clear();
            } catch (err) {
                console.error('Error stopping scanner:', err);
            }
        }

        document.getElementById('start-scan-btn').style.display = 'flex';
        document.getElementById('stop-scan-btn').style.display = 'none';
    }

    async onScanSuccess(decodedText) {
        await this.stopScanning();
        await this.validateQR(decodedText);
    }

    async validateQR(qrData) {
        if (!this.apiUrl) {
            this.showResult('error', '⚙️', 'Error de Configuración', 'Por favor configura la URL de la API');
            return;
        }

        // Show loading
        this.showResult('warning', '⏳', 'Validando...', 'Verificando código QR');

        try {
            // Use GET request only to avoid double validation issues
            const getUrl = `${this.apiUrl}?action=validate&qr=${encodeURIComponent(qrData)}`;
            console.log('Calling API:', getUrl); // DEBUG

            const response = await fetch(getUrl);
            const result = await response.json();

            console.log('API Response:', result); // DEBUG

            this.handleValidationResult(result);

            // Refresh stats after validation
            await this.loadGlobalStats();

        } catch (error) {
            console.error('Validation error:', error);
            this.showResult('error', '❌', 'Error de Conexión', 'No se pudo conectar con el servidor');
        }
    }

    handleValidationResult(result) {
        console.log('Handling result:', result); // DEBUG
        console.log('Success:', result.success, 'Status:', result.status); // DEBUG

        if (result.success && result.status === 'valid') {
            console.log('Case: VALID'); // DEBUG
            this.playSound('success');
            this.showResult(
                'success',
                '✅',
                '¡Bienvenido/a!',
                `${result.guestName}<br><small>${result.message}</small>`
            );
        } else if (result.status === 'already_used') {
            console.log('Case: ALREADY USED'); // DEBUG
            this.playSound('error');
            this.showResult(
                'warning',
                '⚠️',
                'Código Ya Utilizado',
                `${result.guestName}<br><small>Escaneado: ${result.scannedAt}</small>`
            );
        } else {
            this.playSound('error');
            this.showResult(
                'error',
                '❌',
                'Código Inválido',
                result.message || 'Este código QR no es válido'
            );
        }
    }

    async loadGlobalStats() {
        if (!this.apiUrl) {
            console.log('No API URL configured'); // DEBUG
            return;
        }

        try {
            const statsUrl = `${this.apiUrl}?action=stats`;
            console.log('Loading stats from:', statsUrl); // DEBUG

            const response = await fetch(statsUrl);
            console.log('Stats response status:', response.status); // DEBUG

            const result = await response.json();
            console.log('Stats result:', result); // DEBUG

            if (result.success && result.stats) {
                console.log('Updating display with stats:', result.stats); // DEBUG
                this.updateStatsDisplay(result.stats);
                this.updateTimestamp(result.timestamp);
            } else {
                console.error('Stats request failed:', result); // DEBUG
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateStatsDisplay(stats) {
        console.log('updateStatsDisplay called with:', stats); // DEBUG
        document.getElementById('scanned-count').textContent = stats.scanned || 0;
        document.getElementById('pending-count').textContent = stats.pending || 0;
        document.getElementById('total-count').textContent = stats.total || 0;
    }

    updateTimestamp(timestamp) {
        if (!timestamp) {
            document.getElementById('stats-timestamp').textContent = 'Error al cargar estadísticas';
            return;
        }

        const date = new Date(timestamp);
        const formatted = date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        document.getElementById('stats-timestamp').textContent = `Última actualización: ${formatted}`;
    }

    showResult(type, icon, title, message) {
        const resultContent = document.getElementById('result-content');
        resultContent.className = `result-card ${type}`;
        resultContent.innerHTML = `
      <div class="result-icon">${icon}</div>
      <div class="result-title">${title}</div>
      <div class="result-message">${message}</div>
    `;

        document.getElementById('scanner-section').classList.remove('active');
        document.getElementById('result-section').style.display = 'block';
    }

    resetToScanner() {
        document.getElementById('result-section').style.display = 'none';
        document.getElementById('scanner-section').classList.add('active');
    }

    showSettingsModal() {
        document.getElementById('api-url').value = this.apiUrl;
        document.getElementById('settings-modal').classList.add('active');
    }

    closeSettingsModal() {
        document.getElementById('settings-modal').classList.remove('active');
    }

    saveSettings() {
        const apiUrl = document.getElementById('api-url').value.trim();

        if (!apiUrl) {
            alert('Por favor ingresa una URL válida');
            return;
        }

        this.apiUrl = apiUrl;
        localStorage.setItem('apiUrl', apiUrl);
        this.closeSettingsModal();
        alert('Configuración guardada correctamente');

        // Load stats immediately after saving
        this.loadGlobalStats();
    }

    playSound(type) {
        // Create audio context for feedback sounds
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'success') {
            oscillator.frequency.value = 800;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } else {
            oscillator.frequency.value = 200;
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new QRValidatorApp();
});
