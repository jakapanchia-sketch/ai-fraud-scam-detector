const $ = id => document.getElementById(id);

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

let activePreviewUrl = null;

async function analyze() {
    const kindRadio = document.querySelector('input[name="kind"]:checked');
    const kind = kindRadio ? kindRadio.value : 'ไม่ระบุ';

    const message = $('message').value.trim();
    const sender = $('sender').value.trim();
    const amount = $('amount').value.trim();
    const file = $('file').files[0];

    // ตรวจสอบเงื่อนไข
    if ((kind === 'ภาพแนบ' || kind === 'สลิปการโอนเงิน') && !file) {
        alert('กรุณาอัปโหลดไฟล์ภาพหรือสลิปก่อนทำการวิเคราะห์');
        return;
    }

    if (kind === 'ข้อความ' && !message) {
        alert('กรุณากรอกข้อความที่ต้องการตรวจสอบ');
        return;
    }

    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('message', message);
    formData.append('sender', sender);
    formData.append('amount', amount);
    if (file) {
        formData.append('file', file);
    }

    const btn = $('analyze');
    btn.disabled = true;
    btn.textContent = '⏳ AI กำลังวิเคราะห์ข้อมูล...';

    try {
        const res = await fetch('/api/analyze', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        // หากเซิร์ฟเวอร์แจ้ง error กลับมา ให้แสดงข้อความ error ตรงๆ
        if (!res.ok) {
            throw new Error(data.error || 'การประมวลผลล้มเหลว');
        }

        displayResult(data, kind, message);

    } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '🔍 วิเคราะห์ความเสี่ยง';
    }
}

function displayResult(data, kind, message) {
    const { score, level, suspicious_points, reasons, advice } = data;

    let color = '#15966a';
    let riskClass = 'low';

    if (level === 'สูง') {
        color = '#d94343';
        riskClass = 'high';
    } else if (level === 'ปานกลาง') {
        color = '#d48a13';
        riskClass = 'medium';
    }

    $('placeholder').style.display = 'none';
    $('result').style.display = 'block';

    $('score').textContent = score;
    $('gauge').style.background = `conic-gradient(${color} ${score * 3.6}deg, #e8edf5 0deg)`;
    $('risk').textContent = 'ระดับความเสี่ยง = ' + level;
    $('risk').className = 'risk ' + riskClass;
    $('kindTag').textContent = 'ประเภทข้อมูล: ' + kind;

    const combinedPoints = [...(suspicious_points || []), ...(reasons || [])];
    $('reasons').innerHTML = combinedPoints.map(item => `<li>${escapeHtml(item)}</li>`).join('');
    $('advice').innerHTML = (advice || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');

    saveHistory({
        kind,
        score,
        level,
        riskClass,
        message: message ? message.slice(0, 180) : 'ตรวจจากรูปภาพสลิป',
        time: new Date().toLocaleString('th-TH')
    });
}

function saveHistory(item) {
    let history = JSON.parse(localStorage.getItem('scamShieldHistory') || '[]');
    history.unshift(item);
    history = history.slice(0, 15);
    localStorage.setItem('scamShieldHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('scamShieldHistory') || '[]');

    $('history').innerHTML = history.length
        ? history.map(item => `
            <div class="history-item">
                <div>
                    <strong>${escapeHtml(item.kind)}</strong>
                    <br>
                    <span style="color: #718096; font-size: 11px;">${escapeHtml(item.time)}</span>
                </div>
                <div style="text-align: right;">
                    <strong>${item.score}/100</strong>
                    <br>
                    <span class="${item.riskClass || 'low'}">ความเสี่ยง${escapeHtml(item.level)}</span>
                </div>
            </div>
        `).join('')
        : '<div class="empty">ยังไม่มีประวัติการตรวจสอบ</div>';
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = $('file');
    const preview = $('preview');

    if (fileInput) {
        fileInput.addEventListener('change', event => {
            const file = event.target.files[0];
            $('fileName').textContent = file ? file.name : 'ยังไม่ได้เลือกไฟล์';

            if (activePreviewUrl) {
                URL.revokeObjectURL(activePreviewUrl);
                activePreviewUrl = null;
            }

            if (file) {
                activePreviewUrl = URL.createObjectURL(file);
                if (preview) {
                    preview.src = activePreviewUrl;
                    preview.style.display = 'block';
                }
            } else {
                if (preview) {
                    preview.removeAttribute('src');
                    preview.style.display = 'none';
                }
            }
        });
    }

    $('analyze').addEventListener('click', analyze);

    $('newCheck').addEventListener('click', () => {
        $('message').value = '';
        $('sender').value = '';
        $('amount').value = '';
        $('file').value = '';
        $('fileName').textContent = 'ยังไม่ได้เลือกไฟล์';

        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
            activePreviewUrl = null;
        }

        if (preview) {
            preview.removeAttribute('src');
            preview.style.display = 'none';
        }

        $('result').style.display = 'none';
        $('placeholder').style.display = 'grid';
    });

    $('clearHistory').addEventListener('click', () => {
        if (confirm('ต้องการล้างประวัติทั้งหมดหรือไม่?')) {
            localStorage.removeItem('scamShieldHistory');
            renderHistory();
        }
    });

    $('print').addEventListener('click', () => {
        window.print();
    });

    renderHistory();
});