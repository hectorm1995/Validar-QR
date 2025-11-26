// QR Validator App - Main JavaScript
// Handles QR scanning, validation, and UI updates

class QRValidatorApp {
    constructor() {
        this.html5QrCode = null;
        this.apiUrl = localStorage.getItem('apiUrl') || '';
        this.stats = {
            valid: 0,
            invalid: 0,
            used: 0
        };

        this.init();
    }

    init() {
        this.loadStats();
        this.setupEventListeners();
        this.updateStatsDisplay();

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
        document.getElementById('reset-stats-btn').addEventListener('click', () => this.resetStats());
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
            // The GET request will validate AND mark as scanned in one go
            const getUrl = `${this.apiUrl}?action=validate&qr=${encodeURIComponent(qrData)}`;
            console.log('Calling API:', getUrl); // DEBUG

            const response = await fetch(getUrl);
            const result = await response.json();

            console.log('API Response:', result); // DEBUG
            // alert('Respuesta API: ' + JSON.stringify(result)); // Uncomment for mobile debug

            this.handleValidationResult(result);

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
            this.stats.valid++;
            this.playSound('success');
            this.showResult(
                'success',
                '✅',
                '¡Bienvenido/a!',
                `${result.guestName}<br><small>${result.message}</small>`
            );
        } else if (result.status === 'already_used') {
            console.log('Case: ALREADY USED'); // DEBUG
            this.stats.used++;
            this.playSound('error');
            this.showResult(
                'warning',
                '⚠️',
                'Código Ya Utilizado',
                `${result.guestName}<br><small>Escaneado: ${result.scannedAt}</small>`
            );
        } else {
            this.stats.invalid++;
            this.playSound('error');
            this.showResult(
                'error',
                '❌',
                'Código Inválido',
                result.message || 'Este código QR no es válido'
            );
        }

        this.saveStats();
        this.updateStatsDisplay();
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
    }

    resetStats() {
        if (confirm('¿Estás seguro de que quieres resetear las estadísticas?\n\nEsto borrará todos los contadores locales (válidos, inválidos, ya usados).')) {
            this.stats = {
                valid: 0,
                invalid: 0,
                used: 0
            };
            this.saveStats();
            this.updateStatsDisplay();
            alert('✅ Estadísticas reseteadas correctamente');
        }
    }

    updateStatsDisplay() {
        document.getElementById('valid-count').textContent = this.stats.valid;
        document.getElementById('invalid-count').textContent = this.stats.invalid;
        document.getElementById('used-count').textContent = this.stats.used;
    }

    saveStats() {
        localStorage.setItem('stats', JSON.stringify(this.stats));
    }

    loadStats() {
        const saved = localStorage.getItem('stats');
        if (saved) {
            this.stats = JSON.parse(saved);
        }
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
