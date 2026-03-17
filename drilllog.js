// ============================================
// 시추주상도 작성 프로그램 v3
// 참고: BM-1, BM-2, GC-1, BN-1 실제 주상도 기반
// ============================================

let layers = [];
let sptData = [];

const PW = 780;
const PAGE_H = 1100; // A4 비율 고정 높이
let DEPTH_PX = 18; // 동적 계산됨

// 컬럼 정의 (중앙 배치)
const C = {
    elev:    { x: 73,  w: 38 },   // 표고
    scale:   { x: 111, w: 18 },   // Scale
    depth:   { x: 129, w: 38 },   // 심도
    thick:   { x: 167, w: 24 },   // 층후
    colDiag: { x: 191, w: 42 },   // 주상도
    secName: { x: 233, w: 38 },   // 지층명
    desc:    { x: 271, w: 160 },  // 지층설명
    uscs:    { x: 431, w: 24 },   // 통일분류(USCS)
    sampNo:  { x: 455, w: 28 },   // 시료번호
    sampSym: { x: 483, w: 22 },   // 채취방법(기호)
    sampDep: { x: 505, w: 28 },   // 채취심도
    nBlow:   { x: 533, w: 34 },   // N값(N/cm)
    blow:    { x: 567, w: 140 },  // blow 그래프
};
const TL = C.elev.x;
const TR = C.blow.x + C.blow.w; // 707

// 헤더 영역 높이 (범례가 겹치지 않도록 충분한 높이 확보)
const TOP_MARGIN = 30;
const TITLE_H = 48;
const HDR_INFO_Y = TOP_MARGIN + 55;
const HDR_INFO_H = 58;
const COL_HDR_Y = HDR_INFO_Y + HDR_INFO_H + 4;
const COL_HDR_H = 50;
const BODY_TOP = COL_HDR_Y + COL_HDR_H;

// --- UI ---
function toggleSection(header) {
    const body = header.nextElementSibling;
    const arrow = header.querySelector('.toggle-arrow');
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
    arrow.classList.toggle('collapsed');
}

// --- 패턴 자동 매핑 (USCS + 지층명) ---
function uscsToPattern(uscs) {
    if (!uscs) return null;
    const code = uscs.trim().toUpperCase();
    const raw = uscs.trim();
    // USCS 코드
    if (code === 'GW' || code === 'GP') return 'alluvial_gravel';
    if (code === 'GM' || code === 'GC' || code === 'GP-GM') return 'alluvial_gravel_sand';
    if (code === 'SW' || code === 'SP' || code === 'SM') return 'alluvial_sand';
    if (code === 'SC' || code === 'ML' || code === 'MH') return 'alluvial_silt';
    if (code === 'CL' || code === 'CH' || code === 'CL-ML') return 'alluvial_clay';
    if (code === 'OL' || code === 'OH' || code === 'PT') return 'alluvial_clay';
    // 암반류 (USCS에 직접 입력)
    if (raw.includes('풍화토')) return 'weathered_soil';
    if (raw.includes('풍화암')) return 'weathered_rock';
    if (raw.includes('연암')) return 'soft_rock';
    if (raw.includes('경암')) return 'hard_rock';
    return null;
}

function nameToPattern(name) {
    if (!name) return null;
    if (name.includes('풍화토')) return 'weathered_soil';
    if (name.includes('풍화암')) return 'weathered_rock';
    if (name.includes('연암')) return 'soft_rock';
    if (name.includes('경암')) return 'hard_rock';
    return null;
}

function autoSetPattern(i) {
    // USCS 우선, USCS 없으면 지층명(암반류)으로 결정
    const pat = uscsToPattern(layers[i].uscs) || nameToPattern(layers[i].name);
    if (pat) {
        layers[i].pattern = pat;
        refreshLayerTable();
    }
}

function onNameChange(i, value) {
    layers[i].name = value;
    // 지층명이 암반류이고 USCS가 비어있으면 자동으로 USCS에 설정
    if (!layers[i].uscs) {
        if (value.includes('풍화토')) layers[i].uscs = '풍화토';
        else if (value.includes('풍화암')) layers[i].uscs = '풍화암';
        else if (value.includes('연암')) layers[i].uscs = '연암';
        else if (value.includes('경암')) layers[i].uscs = '경암';
    }
    autoSetPattern(i);
}

function onUscsChange(i, value) {
    layers[i].uscs = value;
    autoSetPattern(i);
}

// --- 지층 ---
function addLayer(data) {
    layers.push(data || { topDepth: 0, bottomDepth: 0, name: '', pattern: 'fill', desc: '', uscs: '' });
    refreshLayerTable();
}
function removeLayer(i) { layers.splice(i, 1); refreshLayerTable(); }
function refreshLayerTable() {
    const tb = document.getElementById('layerTableBody');
    tb.innerHTML = '';
    const selIdx = parseInt(document.getElementById('layerFormIdx')?.value ?? -1);
    layers.forEach((l, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (i === selIdx) tr.style.background = '#d4edfa';
        tr.onclick = () => layerFormLoad(i);
        const descShort = (l.desc || '').split('\n').slice(0, 2).join(' ');
        tr.innerHTML = `
            <td style="text-align:center">${i+1}</td>
            <td style="text-align:center">${l.name}</td>
            <td style="text-align:center">${l.topDepth}</td>
            <td style="text-align:center">${l.bottomDepth}</td>
            <td style="text-align:center">${l.uscs || ''}</td>
            <td style="font-size:10px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:120px">${descShort}</td>`;
        tb.appendChild(tr);
    });
}

// 지층 폼: 테이블 행 클릭 → 폼에 로드
function layerFormLoad(i) {
    const l = layers[i];
    document.getElementById('layerFormIdx').value = i;
    document.getElementById('layerFormName').value = l.name;
    document.getElementById('layerFormTop').value = l.topDepth;
    document.getElementById('layerFormBottom').value = l.bottomDepth;
    document.getElementById('layerFormUscs').value = l.uscs || '';
    document.getElementById('layerFormDesc').value = l.desc || '';
    refreshLayerTable();
}

// 지층 폼: 추가
function layerFormAdd() {
    const name = document.getElementById('layerFormName').value;
    const top = parseFloat(document.getElementById('layerFormTop').value) || 0;
    const bottom = parseFloat(document.getElementById('layerFormBottom').value) || 0;
    const uscs = document.getElementById('layerFormUscs').value;
    const desc = document.getElementById('layerFormDesc').value;
    layers.push({ topDepth: top, bottomDepth: bottom, name, pattern: 'fill', desc, uscs });
    autoSetPattern(layers.length - 1);
    layerFormClear();
}

// 지층 폼: 수정
function layerFormUpdate() {
    const idx = parseInt(document.getElementById('layerFormIdx').value);
    if (idx < 0 || idx >= layers.length) { alert('수정할 지층을 선택하세요.'); return; }
    layers[idx].name = document.getElementById('layerFormName').value;
    layers[idx].topDepth = parseFloat(document.getElementById('layerFormTop').value) || 0;
    layers[idx].bottomDepth = parseFloat(document.getElementById('layerFormBottom').value) || 0;
    layers[idx].uscs = document.getElementById('layerFormUscs').value;
    layers[idx].desc = document.getElementById('layerFormDesc').value;
    autoSetPattern(idx);
    refreshLayerTable();
}

// 지층 폼: 삭제
function layerFormDelete() {
    const idx = parseInt(document.getElementById('layerFormIdx').value);
    if (idx < 0 || idx >= layers.length) { alert('삭제할 지층을 선택하세요.'); return; }
    layers.splice(idx, 1);
    layerFormClear();
}

// 지층 폼: 초기화
function layerFormClear() {
    document.getElementById('layerFormIdx').value = -1;
    document.getElementById('layerFormName').value = '매립층';
    document.getElementById('layerFormTop').value = layers.length > 0 ? layers[layers.length - 1].bottomDepth : 0;
    document.getElementById('layerFormBottom').value = 0;
    document.getElementById('layerFormUscs').value = '';
    document.getElementById('layerFormDesc').value = '';
    refreshLayerTable();
}

// --- SPT ---
function refreshSPTTable() {
    const tb = document.getElementById('sptTableBody');
    tb.innerHTML = '';
    const selIdx = parseInt(document.getElementById('sptFormIdx')?.value ?? -1);
    sptData.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        if (i === selIdx) tr.style.background = '#d4edfa';
        tr.onclick = () => sptFormLoad(i);
        tr.innerHTML = `
            <td style="text-align:center">${i+1}</td>
            <td style="text-align:center">${s.depth.toFixed(1)}</td>
            <td style="text-align:center">${s.sampleNo || '-'}</td>
            <td style="text-align:center">${s.method}</td>
            <td style="text-align:center">${s.blow1}/${s.blow2}</td>`;
        tb.appendChild(tr);
    });
}

// SPT 폼: 테이블 행 클릭 → 폼에 로드
function sptFormLoad(i) {
    const s = sptData[i];
    document.getElementById('sptFormIdx').value = i;
    document.getElementById('sptFormDepth').value = s.depth;
    document.getElementById('sptFormSampleNo').value = s.sampleNo || '';
    document.getElementById('sptFormMethod').value = s.method;
    document.getElementById('sptFormBlow1').value = s.blow1;
    document.getElementById('sptFormBlow2').value = s.blow2;
    refreshSPTTable();
}

// SPT 폼: 추가
function sptFormAdd() {
    const depth = parseFloat(document.getElementById('sptFormDepth').value) || 0;
    const sampleNo = document.getElementById('sptFormSampleNo').value;
    const method = document.getElementById('sptFormMethod').value;
    const blow1 = parseInt(document.getElementById('sptFormBlow1').value) || 0;
    const blow2 = parseInt(document.getElementById('sptFormBlow2').value) || 0;
    sptData.push({ depth, sampleNo, method, blow1, blow2 });
    sptFormClear();
}

// SPT 폼: 수정
function sptFormUpdate() {
    const idx = parseInt(document.getElementById('sptFormIdx').value);
    if (idx < 0 || idx >= sptData.length) { alert('수정할 항목을 선택하세요.'); return; }
    sptData[idx].depth = parseFloat(document.getElementById('sptFormDepth').value) || 0;
    sptData[idx].sampleNo = document.getElementById('sptFormSampleNo').value;
    sptData[idx].method = document.getElementById('sptFormMethod').value;
    sptData[idx].blow1 = parseInt(document.getElementById('sptFormBlow1').value) || 0;
    sptData[idx].blow2 = parseInt(document.getElementById('sptFormBlow2').value) || 0;
    refreshSPTTable();
}

// SPT 폼: 삭제
function sptFormDelete() {
    const idx = parseInt(document.getElementById('sptFormIdx').value);
    if (idx < 0 || idx >= sptData.length) { alert('삭제할 항목을 선택하세요.'); return; }
    sptData.splice(idx, 1);
    sptFormClear();
}

// SPT 폼: 초기화
function sptFormClear() {
    document.getElementById('sptFormIdx').value = -1;
    const lastDepth = sptData.length > 0 ? sptData[sptData.length - 1].depth + 1.5 : 0;
    document.getElementById('sptFormDepth').value = lastDepth;
    // S- 번호 자동 증가
    const sptNums = sptData.map(s => {
        const m = s.sampleNo.match(/^S-(\d+)$/);
        return m ? parseInt(m[1]) : 0;
    });
    const nextNum = sptNums.length > 0 ? Math.max(...sptNums) + 1 : 1;
    document.getElementById('sptFormSampleNo').value = `S-${nextNum}`;
    document.getElementById('sptFormMethod').value = 'S.P.T';
    document.getElementById('sptFormBlow1').value = 0;
    document.getElementById('sptFormBlow2').value = 30;
    refreshSPTTable();
}

function autoGenerateSPT() {
    if (!layers.length) { alert('지층 정보를 먼저 입력하세요.'); return; }
    sptData = [];
    const maxD = Math.max(...layers.map(l => l.bottomDepth));
    let cnt = 1;
    for (let d = 1.5; d <= maxD; d += 1.5) {
        const layer = layers.find(l => d >= l.topDepth && d < l.bottomDepth);
        if (!layer) continue;
        const isRock = ['soft_rock','hard_rock'].includes(layer.pattern);
        sptData.push({ depth: d, sampleNo: isRock ? 'N.S' : `S-${cnt}`, method: isRock ? 'N.S' : 'S.P.T', blow1: 0, blow2: 0 });
        cnt++;
    }
    refreshSPTTable();
}

// --- 데이터 ---
function collectFormData() {
    return {
        projectName: document.getElementById('projectName').value,
        holeNo: document.getElementById('holeNo').value,
        location: document.getElementById('location').value,
        elevation: parseFloat(document.getElementById('elevation').value),
        groundWater: document.getElementById('groundWater').value,
        dateFrom: document.getElementById('dateFrom').value,
        dateTo: document.getElementById('dateTo').value,
        inspector: document.getElementById('inspector').value,
        equipment: document.getElementById('equipment').value,
        pageNo: parseInt(document.getElementById('pageNo').value),
        totalPages: parseInt(document.getElementById('totalPages').value),
        layers, sptData
    };
}
async function saveData() {
    const d = collectFormData();
    const json = JSON.stringify(d, null, 2);
    const fileName = `시추주상도_${d.holeNo || 'data'}.json`;
    try {
        // File System Access API (저장 위치 선택)
        const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'JSON 파일', accept: { 'application/json': ['.json'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
    } catch (e) {
        if (e.name === 'AbortError') return; // 취소
        // 미지원 브라우저 fallback
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = fileName;
        a.click();
    }
}
function loadData() { document.getElementById('fileInput').click(); }
function handleFileLoad(e) {
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev => { try { applyFormData(JSON.parse(ev.target.result)); renderPreview(); } catch(err) { alert('파일 오류: '+err.message); } };
    r.readAsText(f); e.target.value='';
}
function applyFormData(d) {
    ['projectName','holeNo','location','groundWater','dateFrom','dateTo','inspector','equipment'].forEach(k => document.getElementById(k).value = d[k]||'');
    document.getElementById('elevation').value = d.elevation||0;
    document.getElementById('pageNo').value = d.pageNo||1;
    document.getElementById('totalPages').value = d.totalPages||1;
    layers = d.layers||[];
    sptData = (d.sptData||[]).map(s => {
        if (s.nValue !== undefined && s.blow1 === undefined) s.blow1 = s.nValue;
        delete s.nValue;
        return s;
    });
    refreshLayerTable(); refreshSPTTable();
}

// --- 샘플 데이터 (GS-2 기반) ---
function loadSampleData() {
    applyFormData({
        projectName: '2025년 지하수자원(금강) 상세조사 시험공',
        holeNo: 'GS-2', location: '사리면 중흥리 986', elevation: 77.16,
        groundWater: 'GL- 2.70', dateFrom: '2025.10.30', dateTo: '2025.10.30',
        inspector: '배경환', equipment: '', pageNo: 1, totalPages: 1,
        layers: [
            { topDepth:0, bottomDepth:1.80, name:'매립층', pattern:'alluvial_sand', desc:'모래 및 자갈 섞인 실트질 모래\n암갈색~담갈색', uscs:'SM' },
            { topDepth:1.80, bottomDepth:3.00, name:'퇴적층', pattern:'alluvial_sand', desc:'자갈이 섞인 점토질 실트\n암갈색~담갈색', uscs:'CL-ML' },
            { topDepth:3.00, bottomDepth:5.50, name:'퇴적층', pattern:'alluvial_sand', desc:'자갈 섞인 모래\n갈색\n조밀~매우조밀', uscs:'SP' },
            { topDepth:5.50, bottomDepth:7.50, name:'풍화토', pattern:'alluvial_sand', desc:'자갈 섞인 실트질 모래\n황갈색\n조밀', uscs:'SM' },
            { topDepth:7.50, bottomDepth:41.00, name:'풍화암', pattern:'weathered_rock', desc:'7.50 ~ 11.0m 실트질 모래\n11.0 ~ 13.0m 이암/혈암\n13.0 ~ 18.0m 이암/혈암 모래\n18.0 ~ 41.0m 이암/혈암', uscs:'풍화암' },
            { topDepth:41.00, bottomDepth:47.00, name:'연암', pattern:'soft_rock', desc:'전체적으로 파쇄 심함\nTCR 96% / RQD 14%', uscs:'연암' }
        ],
        sptData: [
            { depth:0.0, sampleNo:'S-1', method:'S.P.T', blow1:5, blow2:30 },
            { depth:1.5, sampleNo:'S-2', method:'S.P.T', blow1:5, blow2:30 },
            { depth:3.0, sampleNo:'S-3', method:'S.P.T', blow1:9, blow2:30 },
            { depth:4.5, sampleNo:'S-4', method:'S.P.T', blow1:14, blow2:30 },
            { depth:6.0, sampleNo:'S-5', method:'S.P.T', blow1:6, blow2:20 },
            { depth:7.5, sampleNo:'S-6', method:'S.P.T', blow1:50, blow2:9 },
            { depth:9.0, sampleNo:'S-7', method:'S.P.T', blow1:50, blow2:10 },
            { depth:10.5, sampleNo:'S-8', method:'S.P.T', blow1:50, blow2:6 },
            { depth:12.0, sampleNo:'S-9', method:'S.P.T', blow1:50, blow2:6 },
            { depth:13.5, sampleNo:'S-10', method:'S.P.T', blow1:50, blow2:9 },
            { depth:15.0, sampleNo:'S-11', method:'S.P.T', blow1:50, blow2:6 },
            { depth:16.5, sampleNo:'S-12', method:'S.P.T', blow1:50, blow2:7 },
            { depth:18.0, sampleNo:'S-13', method:'S.P.T', blow1:50, blow2:7 },
            { depth:19.5, sampleNo:'S-14', method:'S.P.T', blow1:50, blow2:6 },
            { depth:21.0, sampleNo:'S-15', method:'S.P.T', blow1:50, blow2:5 },
            { depth:22.5, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:24.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:25.5, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:27.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:28.5, sampleNo:'S-16', method:'S.P.T', blow1:50, blow2:5 },
            { depth:30.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:31.5, sampleNo:'S-17', method:'S.P.T', blow1:50, blow2:5 },
            { depth:33.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:34.5, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:36.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:37.5, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:39.0, sampleNo:'', method:'N.S', blow1:50, blow2:5 },
            { depth:40.5, sampleNo:'', method:'N.S', blow1:50, blow2:5 }
        ]
    });
    renderPreview();
}

// ============================================
// 렌더링 엔진 v3
// ============================================
function renderPreview() {
    const data = collectFormData();
    const canvas = document.getElementById('preview-canvas');
    const zoom = parseFloat(document.getElementById('zoomLevel').value);
    const maxDepth = layers.length ? Math.max(...layers.map(l => l.bottomDepth)) : 20;

    // A4 한 페이지 고정 — DEPTH_PX를 동적 계산
    const FOOTER_H = 30;
    const availableH = PAGE_H - BODY_TOP - FOOTER_H;
    DEPTH_PX = availableH / maxDepth;

    const bodyH = maxDepth * DEPTH_PX; // = availableH
    const totalH = PAGE_H;

    canvas.width = PW * zoom;
    canvas.height = totalH * zoom;
    canvas.style.width = (PW * zoom) + 'px';
    canvas.style.height = (totalH * zoom) + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PW, totalH);
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';

    drawTitle(ctx, data);
    drawHeaderInfo(ctx, data);
    drawLegend(ctx);
    drawColHeaders(ctx);
    drawBody(ctx, data, maxDepth);
    drawFooter(ctx, data, BODY_TOP + bodyH);
}

// ========== 타이틀 (BM-1 참고: 넓은 자간, 세리프체) ==========
function drawTitle(ctx, data) {
    // "시 추 주 상 도" - 넓은 자간으로 개별 문자 배치
    ctx.fillStyle = '#000';
    ctx.font = 'bold 26px "Batang", "바탕", serif';
    ctx.textAlign = 'center';
    const titleChars = ['시', '추', '주', '상', '도'];
    const titleW = 240;
    const startX = (PW - titleW) / 2;
    titleChars.forEach((ch, i) => {
        ctx.fillText(ch, startX + i * (titleW / 4), TOP_MARGIN + 30);
    });

    // "DRILL LOG"
    ctx.font = '13px "Batang", serif';
    ctx.fillText('DRILL  LOG', PW / 2, TOP_MARGIN + 48);

    // 페이지 번호 (DRILL LOG 오른쪽, REMARKS 위)
    ctx.textAlign = 'right';
    ctx.font = '8px "Malgun Gothic"';
    ctx.fillText(`페이지 :  ${data.pageNo} 중 ${data.totalPages} 페이지`, TR, TOP_MARGIN + 48);
}

// ========== 헤더 정보 (BM-1 정밀 재현) ==========
function drawHeaderInfo(ctx, data) {
    const y0 = HDR_INFO_Y;
    const rh = 19; // 행 높이
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#000';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#000';

    // BM-1 비율: 좌측 라벨+값 약 55%, 우측 라벨+값 약 45%
    // 헤더 테이블 영역 (범례 영역 전까지)
    const HR = 600; // 헤더 우측 끝 (범례와 안 겹치게)
    const lLbl = TL + 50; // 좌측 라벨 구분
    const midX = 355;     // 좌우 구분
    const rLbl = midX + 50; // 우측 라벨 구분

    // 전체 테이블 외곽선
    ctx.strokeRect(TL, y0, HR - TL, rh * 3);

    // 행 구분 가로선
    hline(ctx, TL, y0 + rh, HR);
    hline(ctx, TL, y0 + rh * 2, HR);

    // 좌측 라벨/값 구분 세로선
    vline(ctx, lLbl, y0, y0 + rh * 3);
    // 좌우 구분 세로선
    vline(ctx, midX, y0, y0 + rh * 3);
    // 우측 라벨/값 구분 세로선
    vline(ctx, rLbl, y0, y0 + rh * 3);

    // 2행 지반표고/지하수위 내부 구분
    const gwDiv = rLbl + 55;
    const gwLbl = gwDiv + 46;
    vline(ctx, gwDiv, y0 + rh, y0 + rh * 2);
    vline(ctx, gwLbl, y0 + rh, y0 + rh * 2);

    // === 행 1: 공사명 | 공번 ===
    drawHdrLabel(ctx, TL + 3, y0 + 3, '공 사 명', 'PROJECT');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(data.projectName, lLbl + 5, y0 + 13);

    drawHdrLabel(ctx, midX + 3, y0 + 3, '공    번', 'HOLE No.');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(data.holeNo, rLbl + 5, y0 + 13);

    // === 행 2: 위치 | 지반표고 + 지하수위 ===
    const r2y = y0 + rh;
    drawHdrLabel(ctx, TL + 3, r2y + 3, '위    치', 'LOCATION');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(data.location, lLbl + 5, r2y + 13);

    drawHdrLabel(ctx, midX + 3, r2y + 3, '지반표고', 'ELEVATION');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(`${data.elevation}    M`, rLbl + 3, r2y + 13);

    ctx.font = '8px "Malgun Gothic"';
    ctx.fillText('지하수위', gwDiv + 2, r2y + 10);
    ctx.font = '6px "Malgun Gothic"';
    ctx.fillText('GROUND WATER', gwDiv + 2, r2y + 17);
    ctx.font = '9px "Malgun Gothic"';
    const gwDisplay = (data.groundWater || '').replace(/^GL-/, '(GL-)');
    ctx.fillText(`${gwDisplay}   M`, gwLbl + 3, r2y + 13);

    // === 행 3: 날짜 | 감독자 ===
    const r3y = y0 + rh * 2;
    drawHdrLabel(ctx, TL + 3, r3y + 3, '날    짜', 'DATE');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(`${data.dateFrom}   ~   ${data.dateTo}`, lLbl + 5, r3y + 13);

    drawHdrLabel(ctx, midX + 3, r3y + 3, '감 독 자', 'INSPECTOR');
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(data.inspector, rLbl + 5, r3y + 13);
}

function drawHdrLabel(ctx, x, y, ko, en) {
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(ko, x, y + 8);
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText(en, x, y + 16);
}

// ========== 범례 (헤더 우측, 표 안에 배치) ==========
function drawLegend(ctx) {
    const lx = 603;                    // 범례 박스 좌측
    const ly = HDR_INFO_Y;             // 헤더와 같은 y 시작
    const boxW = TR - lx;             // 박스 너비
    const boxH = COL_HDR_Y - ly - 2;  // 컬럼 헤더 직전까지
    const titleH = 13;                // 제목 행 높이

    ctx.lineWidth = 0.6;
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';

    // 범례 박스 외곽선
    ctx.strokeRect(lx, ly, boxW, boxH);

    // 제목 구분선
    hline(ctx, lx, ly + titleH, lx + boxW);

    // 제목 텍스트
    ctx.textAlign = 'left';
    ctx.font = 'bold 6px "Malgun Gothic"';
    ctx.fillText('(주) 시료채취방법의 기호', lx + 3, ly + 9);
    ctx.textAlign = 'right';
    ctx.font = '5px "Malgun Gothic"';
    ctx.fillText('REMARKS', lx + boxW - 3, ly + 9);
    ctx.textAlign = 'left';

    // 범례 항목
    const items = [
        ['○', '자연시료',               'U.D. SAMPLE'],
        ['◎', '표준관입시험에 의한 시료', 'S.P.T. SAMPLE'],
        ['●', '코어시료',               'CORE SAMPLE'],
        ['⊗', '흐트러진 시료',          'DISTURBED SAMPLE'],
    ];
    const contentTop = ly + titleH;
    const contentH = boxH - titleH;
    const rowH = contentH / items.length;

    items.forEach(([sym, kor, eng], i) => {
        const rowY = contentTop + i * rowH;
        // 행 구분선
        if (i > 0) {
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 0.3;
            hline(ctx, lx, rowY, lx + boxW);
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 0.6;
        }
        const cy = rowY + rowH / 2; // 행 중앙
        // 기호
        ctx.font = '8px "Malgun Gothic"';
        ctx.fillStyle = '#000';
        ctx.fillText(sym, lx + 3, cy + 2);
        // 한국어
        ctx.font = '6px "Malgun Gothic"';
        ctx.fillText(kor, lx + 14, cy - 1);
        // 영어
        ctx.font = '5px "Malgun Gothic"';
        ctx.fillStyle = '#555';
        ctx.fillText(eng, lx + 14, cy + 6);
        ctx.fillStyle = '#000';
    });
}

// ========== 컬럼 헤더 ==========
function drawColHeaders(ctx) {
    const y0 = COL_HDR_Y;
    const h = COL_HDR_H;
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#000';

    // 외곽
    ctx.strokeRect(TL, y0, TR - TL, h);

    // 세로선 (시료, N값, blow 서브컬럼 제외 - 그룹 아래에서 별도 처리)
    const mainCols = [C.elev, C.scale, C.depth, C.thick, C.colDiag, C.secName, C.desc, C.uscs];
    mainCols.forEach(c => vline(ctx, c.x, y0, y0 + h));
    // 시료 그룹 좌측 경계 (전체 높이)
    vline(ctx, C.sampNo.x, y0, y0 + h);
    // 표준관입시험 그룹 좌측 경계 (전체 높이)
    vline(ctx, C.nBlow.x, y0, y0 + h);

    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';

    // 좌측 컬럼들
    hdrText(ctx, C.elev, y0, ['표고', 'Elev.', '(EL.M)']);
    hdrText(ctx, C.scale, y0, ['축척', 'Scale']);
    hdrText(ctx, C.depth, y0, ['심도', 'Depth', '(M)']);
    hdrText(ctx, C.thick, y0, ['층후', 'Thick-', 'ness', 'M']);
    hdrText(ctx, C.colDiag, y0, ['주상도', 'Columnar']);
    hdrText(ctx, C.secName, y0, ['지층명', 'Section']);

    // 지층설명
    const dcx = C.desc.x + C.desc.w / 2;
    ctx.font = 'bold 9px "Malgun Gothic"';
    ctx.fillText('지  층  설  명', dcx, y0 + 20);
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText('Description', dcx, y0 + 32);

    // 통일분류 USCS 세로 표기
    const ux = C.uscs.x + C.uscs.w / 2;
    ctx.font = '7px "Malgun Gothic"';
    ['통','일','분','류'].forEach((ch, i) => ctx.fillText(ch, ux - 5, y0 + 11 + i * 9));
    ['U','S','C','S'].forEach((ch, i) => ctx.fillText(ch, ux + 6, y0 + 11 + i * 9));

    // 시료 Sample 그룹
    const sgx = C.sampNo.x;
    const sgw = C.sampNo.w + C.sampSym.w + C.sampDep.w;
    const sampDivY = y0 + 24;
    ctx.font = 'bold 8px "Malgun Gothic"';
    ctx.fillText('시    료', sgx + sgw / 2, y0 + 11);
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText('Sample', sgx + sgw / 2, y0 + 20);
    // 그룹 구분선
    hline(ctx, sgx, sampDivY, sgx + sgw);
    // 서브 컬럼 세로선 (구분선 아래부터만)
    vline(ctx, C.sampSym.x, sampDivY, y0 + h);
    vline(ctx, C.sampDep.x, sampDivY, y0 + h);
    // 서브 컬럼 라벨
    ctx.font = '6px "Malgun Gothic"';
    ctx.fillText('시료', C.sampNo.x + C.sampNo.w / 2, y0 + 34);
    ctx.fillText('번호', C.sampNo.x + C.sampNo.w / 2, y0 + 42);
    ctx.fillText('채취', C.sampSym.x + C.sampSym.w / 2, y0 + 34);
    ctx.fillText('방법', C.sampSym.x + C.sampSym.w / 2, y0 + 42);
    ctx.fillText('채취', C.sampDep.x + C.sampDep.w / 2, y0 + 34);
    ctx.fillText('심도', C.sampDep.x + C.sampDep.w / 2, y0 + 42);

    // 표준관입시험 그룹 헤더 (N값 + blow 전체)
    const sptLeft = C.nBlow.x;
    const sptRight = C.blow.x + C.blow.w;
    const sptCx = (sptLeft + sptRight) / 2;
    const sptDivY = y0 + 24;

    ctx.font = 'bold 9px "Malgun Gothic"';
    ctx.fillText('표준관입시험', sptCx, y0 + 11);
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText('Standard Penetration Test', sptCx, y0 + 21);

    // 그룹 헤더 구분선
    hline(ctx, sptLeft, sptDivY, sptRight);
    // N값과 blow 구분 세로선
    vline(ctx, C.blow.x, sptDivY, y0 + h);

    // N값 (회/cm)
    const nx = C.nBlow.x + C.nBlow.w / 2;
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText('N값', nx, y0 + 34);
    ctx.font = '6px "Malgun Gothic"';
    ctx.fillText('(회/cm)', nx, y0 + 43);

    // blow 영역: "N  blow" 위, 숫자 아래
    const bgl = C.blow.x + 4;
    const bgw = C.blow.w - 8;
    // "N  blow" 텍스트 (숫자 위, 중앙 정렬)
    ctx.textAlign = 'center';
    const blowCx = C.blow.x + C.blow.w / 2;
    ctx.font = '7px "Malgun Gothic"';
    ctx.fillText('N          blow', blowCx, y0 + 34);
    // 숫자 10 20 30 40 50
    ctx.font = '7px "Malgun Gothic"';
    for (let n = 10; n <= 50; n += 10) {
        const nx2 = bgl + (n / 50) * bgw;
        ctx.fillText(n.toString(), nx2, y0 + 44);
    }
}

function hdrText(ctx, col, y0, lines) {
    const cx = col.x + col.w / 2;
    let ty = y0 + 12;
    lines.forEach((t, i) => {
        ctx.font = i === 0 ? 'bold 9px "Malgun Gothic"' : '7px "Malgun Gothic"';
        ctx.fillText(t, cx, ty);
        ty += (i === 0 ? 12 : 10);
    });
}

// ========== 본문 ==========
function drawBody(ctx, data, maxDepth) {
    const bt = BODY_TOP;
    const bodyH = maxDepth * DEPTH_PX;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.5;

    // 외곽
    ctx.strokeRect(TL, bt, TR - TL, bodyH);

    // 세로선
    const allCols = [C.elev, C.scale, C.depth, C.thick, C.colDiag, C.secName, C.desc, C.uscs, C.sampNo, C.sampSym, C.sampDep, C.nBlow, C.blow];
    allCols.forEach(c => vline(ctx, c.x, bt, bt + bodyH));

    // 스케일 눈금: 1m=긴선, 0.5m=중간선, 0.1m=짧은선
    ctx.strokeStyle = '#000';
    const sx = C.scale.x;
    const sw = C.scale.w;
    // 0.1m 간격 짧은선 (오른쪽 1/4만)
    ctx.lineWidth = 0.2;
    for (let d = 0.1; d < maxDepth; d += 0.1) {
        const sy = bt + d * DEPTH_PX;
        hline(ctx, sx + sw * 0.75, sy, sx + sw);
    }
    // 0.5m 간격 중간선 (오른쪽 절반)
    ctx.lineWidth = 0.3;
    for (let d = 0.5; d < maxDepth; d += 0.5) {
        const sy = bt + d * DEPTH_PX;
        hline(ctx, sx + sw / 2, sy, sx + sw);
    }
    // 1m 간격 긴선 (전체 너비)
    ctx.lineWidth = 0.3;
    for (let d = 1; d < maxDepth; d++) {
        const sy = bt + d * DEPTH_PX;
        hline(ctx, sx, sy, sx + sw);
    }
    // 5m 간격 굵은 긴선
    ctx.lineWidth = 0.6;
    for (let d = 5; d < maxDepth; d += 5) {
        const sy = bt + d * DEPTH_PX;
        hline(ctx, sx, sy, sx + sw);
    }

    // ===== 지층 =====
    // 1단계: 설명 텍스트 높이 계산 → 설명 컬럼 경계 Y 좌표 결정
    const descFontSize = 8;
    const descLineGap = descFontSize + 2;
    let descBoundaries = []; // 각 지층의 설명 컬럼 시작/끝 Y
    let descCursorY = bt;   // 설명 컬럼의 현재 Y 커서

    const diagW = 20; // 사선 구간 너비
    layers.forEach((layer) => {
        const y1 = bt + layer.topDepth * DEPTH_PX;
        const y2 = bt + layer.bottomDepth * DEPTH_PX;
        const descLines = layer.desc ? layer.desc.split('\n') : [];
        const totalDescLines = 1 + 1 + descLines.length; // ▶제목 + 심도 + 내용
        const textH = totalDescLines * descLineGap + 4; // 텍스트 높이

        const descStartY = Math.max(y1, descCursorY);
        const descEndY = Math.max(y2, descStartY + textH);

        descBoundaries.push({ descStartY, descEndY });
        descCursorY = descEndY;
    });

    ctx.strokeStyle = '#000';
    layers.forEach((layer, idx) => {
        const y1 = bt + layer.topDepth * DEPTH_PX;
        const y2 = bt + layer.bottomDepth * DEPTH_PX;
        const h = y2 - y1;
        const { descStartY, descEndY } = descBoundaries[idx];

        // 경계선
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = '#000';
        if (idx > 0) {
            // 설명 컬럼 외 영역 (실제 심도 기준 수평선)
            hline(ctx, TL, y1, C.desc.x);
            hline(ctx, C.desc.x + C.desc.w, y1, C.uscs.x + C.uscs.w);
            // 설명 컬럼: 왼쪽 사선 + 수평선 + 오른쪽 사선 (사다리꼴)
            if (Math.abs(descStartY - y1) > 1) {
                // 왼쪽 짧은 사선: (desc.x, y1) → (desc.x + diagW, descStartY)
                ctx.beginPath();
                ctx.moveTo(C.desc.x, y1);
                ctx.lineTo(C.desc.x + diagW, descStartY);
                ctx.stroke();
                // 수평선: diagW ~ (desc.w - diagW) 구간
                hline(ctx, C.desc.x + diagW, descStartY, C.desc.x + C.desc.w - diagW);
                // 오른쪽 짧은 사선: (desc.x+desc.w-diagW, descStartY) → (desc.x+desc.w, y1)
                ctx.beginPath();
                ctx.moveTo(C.desc.x + C.desc.w - diagW, descStartY);
                ctx.lineTo(C.desc.x + C.desc.w, y1);
                ctx.stroke();
            } else {
                // 차이 없으면 수평선
                hline(ctx, C.desc.x, y1, C.desc.x + C.desc.w);
            }
        }
        // 마지막 지층 아래쪽도 같은 형태
        if (idx === layers.length - 1 && Math.abs(descEndY - y2) > 1) {
            ctx.beginPath();
            ctx.moveTo(C.desc.x, y2);
            ctx.lineTo(C.desc.x + diagW, descEndY);
            ctx.stroke();
            hline(ctx, C.desc.x + diagW, descEndY, C.desc.x + C.desc.w - diagW);
            ctx.beginPath();
            ctx.moveTo(C.desc.x + C.desc.w - diagW, descEndY);
            ctx.lineTo(C.desc.x + C.desc.w, y2);
            ctx.stroke();
        } else if (idx === layers.length - 1) {
            hline(ctx, C.desc.x, y2, C.desc.x + C.desc.w);
        }

        // 텍스트 크기를 층 높이에 맞게 동적 조절
        const fontSize = Math.min(8, Math.max(5, h * 0.35));

        // ---- 표고 (경계에 표시, 첫 지층 제외) ----
        ctx.fillStyle = '#000';
        ctx.textAlign = 'right';
        ctx.font = `${fontSize}px "Malgun Gothic"`;
        if (idx > 0 && h > 10) {
            ctx.fillText((data.elevation - layer.topDepth).toFixed(2), C.elev.x + C.elev.w - 2, y1 - 1);
        }

        // ---- 심도 ----
        if (layer.topDepth > 0 && h > 10) {
            ctx.textAlign = 'center';
            ctx.fillText(layer.topDepth.toFixed(1), C.depth.x + C.depth.w / 2, y1 - 1);
        }

        // ---- 층후 (경계선 정렬, 심도와 동일) ----
        const thickness = (layer.bottomDepth - layer.topDepth).toFixed(2);
        ctx.textAlign = 'center';
        ctx.font = '7px "Malgun Gothic"';
        ctx.fillText(thickness, C.thick.x + C.thick.w / 2, y2 - 1);

        // ---- 주상도 패턴 ----
        drawPattern(ctx, C.colDiag.x + 1, y1, C.colDiag.w - 2, h, layer.pattern);

        // ---- 지층명 (컬럼 내 중앙, 고정 폰트) ----
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.font = '8px "Malgun Gothic"';
        ctx.fillText(layer.name, C.secName.x + C.secName.w / 2, y1 + h / 2 + 3);

        // ---- 설명 (▶ 지층명 + 심도 + 내용, 사다리꼴 안에 텍스트 배치) ----
        ctx.textAlign = 'left';
        ctx.fillStyle = '#000';
        const descLines = layer.desc ? layer.desc.split('\n') : [];
        const textLeft = C.desc.x + diagW + 2; // 왼쪽 사선 안쪽
        let dy = descStartY + descLineGap;
        ctx.font = `bold ${descFontSize + 1}px "Malgun Gothic"`;
        ctx.fillText(`▶${layer.name}`, textLeft, dy);
        ctx.font = `${descFontSize}px "Malgun Gothic"`;
        dy += descLineGap;
        // 심도 자동 표시
        ctx.fillText(`심도 : ${layer.topDepth.toFixed(2)} ~ ${layer.bottomDepth.toFixed(2)}m`, textLeft + 4, dy);
        dy += descLineGap;
        descLines.forEach(dl => {
            ctx.fillText(dl, textLeft + 4, dy);
            dy += descLineGap;
        });

        // ---- USCS ----
        if (layer.uscs) {
            ctx.fillStyle = '#000';
            ctx.textAlign = 'center';
            ctx.font = '7px "Malgun Gothic"';
            ctx.fillText(layer.uscs, C.uscs.x + C.uscs.w / 2, y1 + h / 2 + 3);
        }
    });

    // 마지막 지층 하단 표고/심도
    if (layers.length > 0) {
        const last = layers[layers.length - 1];
        const yEnd = bt + last.bottomDepth * DEPTH_PX;
        ctx.fillStyle = '#000';
        ctx.textAlign = 'right';
        ctx.font = '8px "Malgun Gothic"';
        ctx.fillText((data.elevation - last.bottomDepth).toFixed(2), C.elev.x + C.elev.w - 2, yEnd - 3);
        ctx.textAlign = 'center';
        ctx.fillText(last.bottomDepth.toFixed(1), C.depth.x + C.depth.w / 2, yEnd - 3);
    }

    // SPT
    drawSPT(ctx, data, bt, maxDepth);

    // blow 그래프 눈금 세로선
    const bgl = C.blow.x + 4;
    const bgw = C.blow.w - 8;
    for (let n = 1; n <= 50; n += 1) {
        const nx2 = bgl + (n / 50) * bgw;
        if (n % 10 === 0) {
            // 주눈금 (10, 20, 30, 40, 50)
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 0.5;
        } else if (n % 5 === 0) {
            // 중간눈금 (5, 15, 25, 35, 45)
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 0.3;
        } else {
            // 세부눈금 (1, 2, 3, ...)
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 0.3;
        }
        vline(ctx, nx2, bt, bt + bodyH);
    }
}

// ========== 보어홀 상단 사다리꼴 ==========
function drawBoreholeTop(ctx, bt) {
    const x = C.colDiag.x;
    const w = C.colDiag.w;
    const cx = x + w / 2;
    const trapH = 8; // 사다리꼴 높이

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // 좌측 사선
    ctx.moveTo(x + 1, bt);
    ctx.lineTo(cx - 8, bt + trapH);
    // 하단 가로선
    ctx.lineTo(cx + 8, bt + trapH);
    // 우측 사선
    ctx.lineTo(x + w - 1, bt);
    ctx.stroke();

    // V자 톱니 (사다리꼴 아래)
    ctx.lineWidth = 0.8;
    const vStart = bt + trapH;
    const n = 4;
    const segW = 16 / n;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const sx = cx - 8 + i * segW;
        ctx.moveTo(sx, vStart);
        ctx.lineTo(sx + segW / 2, vStart + 4);
        ctx.lineTo(sx + segW, vStart);
    }
    ctx.stroke();
}

// ========== 지하수위 ==========
function drawGroundWater(ctx, data, bt) {
    if (!data.groundWater) return;
    const gwMatch = data.groundWater.match(/([\d.]+)/);
    if (!gwMatch) return;
    const gwDepth = parseFloat(gwMatch[1]);
    const gwY = bt + gwDepth * DEPTH_PX;

    // 참고이미지: 주상도 컬럼 좌측 경계(scale 컬럼과 사이)에 역삼각형
    const triX = C.colDiag.x;
    const triSize = 5;

    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(triX - triSize, gwY);
    ctx.lineTo(triX + triSize, gwY);
    ctx.lineTo(triX, gwY + triSize + 1);
    ctx.closePath();
    ctx.fill();
}

// ========== SPT ==========
function drawSPT(ctx, data, bt, maxDepth) {
    const bgl = C.blow.x + 4;
    const bgw = C.blow.w - 8;

    // 선그래프용 좌표 수집
    const linePoints = [];

    // SPT 간격에 맞는 폰트 크기 계산
    const sptGap = DEPTH_PX * 1.5; // 1.5m 간격
    const sptFont = Math.min(7, Math.max(4, sptGap * 0.4));
    const sptSymFont = Math.min(10, Math.max(5, sptGap * 0.55));

    sptData.forEach((spt) => {
        // SPT 위치 = 해당 심도
        const sy = bt + spt.depth * DEPTH_PX;

        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';

        // 시료번호
        ctx.font = `${sptFont}px "Malgun Gothic"`;
        if (spt.sampleNo && spt.method !== 'N.S') {
            ctx.fillText(spt.sampleNo, C.sampNo.x + C.sampNo.w / 2, sy + 3);
        } else if (spt.method === 'N.S') {
            ctx.fillText(spt.sampleNo || 'N.S', C.sampNo.x + C.sampNo.w / 2, sy + 3);
        }

        // 채취방법 기호
        ctx.font = `${sptSymFont}px "Malgun Gothic"`;
        let sym = '◎'; // S.P.T
        if (spt.method === 'U.D') sym = '○';
        else if (spt.method === 'CORE') sym = '●';
        else if (spt.method === 'N.S') sym = '';
        if (sym) ctx.fillText(sym, C.sampSym.x + C.sampSym.w / 2, sy + 4);

        // 채취심도
        ctx.font = `${sptFont}px "Malgun Gothic"`;
        ctx.fillText(spt.depth.toFixed(1), C.sampDep.x + C.sampDep.w / 2, sy + 3);

        // N값/타격 (BM-1 참고: "50/8" = 타격횟수/관입량cm)
        ctx.font = `${sptFont + 1}px "Malgun Gothic"`;
        const nStr = `${spt.blow1}/${spt.blow2}`;
        ctx.fillText(nStr, C.nBlow.x + C.nBlow.w / 2, sy + 3);

        // 선그래프용 좌표
        const nClamp = Math.min(spt.blow1, 50);
        const px = bgl + (nClamp / 50) * bgw;
        linePoints.push({ x: px, y: sy });
    });

    // 꺾은선 그래프 그리기
    if (linePoints.length > 0) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(linePoints[0].x, linePoints[0].y);
        for (let i = 1; i < linePoints.length; i++) {
            ctx.lineTo(linePoints[i].x, linePoints[i].y);
        }
        ctx.stroke();

        // 각 데이터 포인트에 점 표시
        linePoints.forEach(pt => {
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// ========== 지층 패턴 ==========
function drawPattern(ctx, x, y, w, h, pattern) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    ctx.lineWidth = 0.4;

    switch (pattern) {
        case 'fill': patFill(ctx, x, y, w, h); break;
        case 'alluvial_sand': patSand(ctx, x, y, w, h); break;
        case 'alluvial_silt': patSilt(ctx, x, y, w, h); break;
        case 'alluvial_clay': patClay(ctx, x, y, w, h); break;
        case 'alluvial_gravel': patGravel(ctx, x, y, w, h); break;
        case 'alluvial_gravel_sand': patGravelSand(ctx, x, y, w, h); break;
        case 'weathered_soil': patWS(ctx, x, y, w, h); break;
        case 'weathered_rock': patWR(ctx, x, y, w, h); break;
        case 'soft_rock': patSR(ctx, x, y, w, h); break;
        case 'hard_rock': patHR(ctx, x, y, w, h); break;
    }
    ctx.restore();
}

// 매립층: 점 + 간헐적 자갈(원) - BM-1 참고
function patFill(ctx, x, y, w, h) {
    // 점
    for (let dy = 4; dy < h; dy += 6) {
        for (let dx = 4; dx < w; dx += 7) {
            const off = (Math.floor(dy / 6) % 2) * 3;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 0.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // 자갈 (둥근 원, 간헐적)
    const seed = [
        [0.2, 0.3, 3], [0.6, 0.15, 2.5], [0.35, 0.55, 3.5],
        [0.75, 0.7, 2.8], [0.15, 0.8, 3], [0.5, 0.4, 4],
        [0.8, 0.5, 2.5], [0.3, 0.2, 3.2], [0.65, 0.85, 3],
    ];
    seed.forEach(([rx, ry, r]) => {
        const px = x + rx * w;
        const py = y + ry * h;
        if (py < y + h && py > y) {
            ctx.beginPath();
            ctx.ellipse(px, py, r, r * 0.7, 0.2, 0, Math.PI * 2);
            ctx.stroke();
        }
    });
}

// 퇴적층(모래): 균일한 점
// 모래(SM): 세로선 + 점 (예시 GS-2 참고)
function patSand(ctx, x, y, w, h) {
    // 세로선 (간격 넓게)
    ctx.lineWidth = 0.3;
    for (let dx = 5; dx < w; dx += 6) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 1);
        ctx.lineTo(x + dx, y + h - 1);
        ctx.stroke();
    }
    // 점 (크게)
    for (let dy = 3; dy < h; dy += 5) {
        for (let dx = 3; dx < w; dx += 5) {
            const off = (Math.floor(dy / 5) % 2) * 2.5;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 1.0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 퇴적층(실트): 짧은 수평 대시
function patSilt(ctx, x, y, w, h) {
    ctx.lineWidth = 0.4;
    for (let dy = 4; dy < h; dy += 5) {
        for (let dx = 2; dx < w; dx += 9) {
            const off = (Math.floor(dy / 5) % 2) * 4;
            ctx.beginPath();
            ctx.moveTo(x + dx + off, y + dy);
            ctx.lineTo(x + dx + off + 4, y + dy);
            ctx.stroke();
        }
    }
}

// 퇴적층(점토/CL-ML): 세로선 패턴 (예시 GS-2 참고)
function patClay(ctx, x, y, w, h) {
    ctx.lineWidth = 0.3;
    for (let dx = 3; dx < w; dx += 3.5) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 1);
        ctx.lineTo(x + dx, y + h - 1);
        ctx.stroke();
    }
}

// 자갈(GM/GC/GP-GM): 세로선 + 큰 채워진 원 (예시 NGC-1 참고)
function patGravelSand(ctx, x, y, w, h) {
    // 세로선
    ctx.lineWidth = 0.3;
    for (let dx = 5; dx < w; dx += 6) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + 1);
        ctx.lineTo(x + dx, y + h - 1);
        ctx.stroke();
    }
    // 큰 채워진 자갈 원
    for (let dy = 7; dy < h; dy += 10) {
        for (let dx = 7; dx < w; dx += 12) {
            const off = (Math.floor(dy / 10) % 2) * 6;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 퇴적층(자갈/GP): 큰 채워진 원 (예시 BM-2 참고)
function patGravel(ctx, x, y, w, h) {
    // 바탕 점
    for (let dy = 3; dy < h; dy += 5) {
        for (let dx = 3; dx < w; dx += 6) {
            const off = (Math.floor(dy / 5) % 2) * 3;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // 큰 채워진 자갈 원
    for (let dy = 7; dy < h; dy += 10) {
        for (let dx = 7; dx < w; dx += 12) {
            const off = (Math.floor(dy / 10) % 2) * 6;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 풍화토: 촘촘한 점 (모래보다 밀도 높음, BM-1 참고)
function patWS(ctx, x, y, w, h) {
    for (let dy = 2.5; dy < h; dy += 3.5) {
        for (let dx = 2.5; dx < w; dx += 4) {
            const off = (Math.floor(dy / 3.5) % 2) * 2;
            ctx.beginPath();
            ctx.arc(x + dx + off, y + dy, 0.7, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// 풍화암: 간헐적 굵은 사선 + 십자(+)
function patWR(ctx, x, y, w, h) {
    // 간헐적 굵은 사선 (좌하향 ↙)
    ctx.lineWidth = 1.2;
    const gap = 32;
    for (let d = -h; d < w + h; d += gap) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d - h, y + h);
        ctx.stroke();
    }
    // 십자(+) 패턴
    ctx.lineWidth = 0.6;
    for (let dy = 8; dy < h; dy += 14) {
        for (let dx = 8; dx < w; dx += 14) {
            const off = (Math.floor(dy / 14) % 2) * 7;
            const px = x + dx + off;
            const py = y + dy;
            ctx.beginPath();
            ctx.moveTo(px - 3, py);
            ctx.lineTo(px + 3, py);
            ctx.moveTo(px, py - 3);
            ctx.lineTo(px, py + 3);
            ctx.stroke();
        }
    }
}

// 연암: 간헐적 연한 사선 + 십자(+)
function patSR(ctx, x, y, w, h) {
    // 간헐적 연한 사선 (좌하향 ↙)
    ctx.lineWidth = 0.4;
    const gap = 32;
    for (let d = -h; d < w + h; d += gap) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d - h, y + h);
        ctx.stroke();
    }
    // 십자(+) 패턴
    ctx.lineWidth = 0.6;
    for (let dy = 8; dy < h; dy += 14) {
        for (let dx = 8; dx < w; dx += 14) {
            const off = (Math.floor(dy / 14) % 2) * 7;
            const px = x + dx + off;
            const py = y + dy;
            ctx.beginPath();
            ctx.moveTo(px - 3, py);
            ctx.lineTo(px + 3, py);
            ctx.moveTo(px, py - 3);
            ctx.lineTo(px, py + 3);
            ctx.stroke();
        }
    }
}

// 경암: 십자(+) 패턴만
function patHR(ctx, x, y, w, h) {
    ctx.lineWidth = 0.6;
    for (let dy = 8; dy < h; dy += 14) {
        for (let dx = 8; dx < w; dx += 14) {
            const off = (Math.floor(dy / 14) % 2) * 7;
            const px = x + dx + off;
            const py = y + dy;
            ctx.beginPath();
            ctx.moveTo(px - 3, py);
            ctx.lineTo(px + 3, py);
            ctx.moveTo(px, py - 3);
            ctx.lineTo(px, py + 3);
            ctx.stroke();
        }
    }
}

// ========== 하단 ==========
function drawFooter(ctx, data, yEnd) {
    if (!layers.length) return;
    const last = layers[layers.length - 1];

    // 본문 테이블 하단 마감선
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    hline(ctx, TL, yEnd, TR);

    // 시추종료 텍스트
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.font = '9px "Malgun Gothic"';
    ctx.fillText(`* 심도 ${last.bottomDepth.toFixed(2)} M 에서 시추종료`, PW / 2, yEnd + 18);
}

// ========== PNG 출력 ==========
function exportPDF() {
    const data = collectFormData();
    const maxDepth = layers.length ? Math.max(...layers.map(l => l.bottomDepth)) : 20;
    const FOOTER_H = 30;
    const availableH = PAGE_H - BODY_TOP - FOOTER_H;
    DEPTH_PX = availableH / maxDepth;
    const totalH = PAGE_H;

    const scale = 2;
    const tmp = document.createElement('canvas');
    tmp.width = PW * scale;
    tmp.height = totalH * scale;
    const ctx = tmp.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, PW, totalH);
    ctx.fillStyle = '#000';

    drawTitle(ctx, data);
    drawHeaderInfo(ctx, data);
    drawLegend(ctx);
    drawColHeaders(ctx);
    drawBody(ctx, data, maxDepth);
    const bodyH = maxDepth * DEPTH_PX;
    drawFooter(ctx, data, BODY_TOP + bodyH);

    const fileName = `시추주상도_${data.holeNo || 'output'}.png`;
    tmp.toBlob(async (blob) => {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: fileName,
                types: [{ description: 'PNG 이미지', accept: { 'image/png': ['.png'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
        } catch (e) {
            if (e.name === 'AbortError') return;
            const a = document.createElement('a');
            a.download = fileName;
            a.href = URL.createObjectURL(blob);
            a.click();
        }
    }, 'image/png');
}

// ========== 유틸 ==========
function hline(ctx, x1, y, x2) {
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}
function vline(ctx, x, y1, y2) {
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
    refreshLayerTable();
    refreshSPTTable();
    renderPreview();
});
