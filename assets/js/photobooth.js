/**
 * Photobooth - d-wardrobe style, black & white theme
 * Polaroid + Photo strip modes, stickers, gallery
 */
(function () {
  const STRIP_PHOTO_COUNT = 4
  const GALLERY_KEY = 'ec-photobooth-gallery'
  const STICKER_CATEGORIES = {
    'Hearts & Cute': ['❤️', '✨', '⭐', '🌸', '💕', '💖', '🌟', '🩷'],
    Fruits: ['🍎', '🍊', '🍋', '🍇', '🍓', '🍑', '🍒', '🥝', '🍌', '🍉'],
    Animals: ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🦁', '🐸', '🐷'],
  }

  function drawSerration(ctx, y, x1, x2, toothW) {
    const len = x2 - x1
    const teeth = Math.max(2, Math.floor(len / (toothW * 2)))
    const step = len / teeth
    ctx.beginPath()
    ctx.moveTo(x1, y)
    for (let i = 1; i < teeth; i++) {
      const x = x1 + i * step
      ctx.lineTo(x, y + toothW)
      ctx.lineTo(x + step, y)
    }
    ctx.lineTo(x2, y)
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  function drawVideoCover(ctx, video, dx, dy, dw, dh) {
    const vw = video.videoWidth
    const vh = video.videoHeight
    const destAspect = dw / dh
    const srcAspect = vw / vh
    let sx, sy, sw, sh
    if (destAspect > srcAspect) {
      sh = vh
      sw = vh * destAspect
      sx = (vw - sw) / 2
      sy = 0
    } else {
      sw = vw
      sh = vw / destAspect
      sx = 0
      sy = (vh - sh) / 2
    }
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh)
  }

  function getGallery() {
    try {
      return JSON.parse(localStorage.getItem(GALLERY_KEY) || '[]')
    } catch { return [] }
  }

  function saveToGallery(photo) {
    const list = getGallery()
    const item = photo.id ? photo : { id: crypto.randomUUID(), imageData: photo.imageData, type: photo.type, createdAt: Date.now() }
    list.push(item)
    localStorage.setItem(GALLERY_KEY, JSON.stringify(list))
  }

  function removeFromGallery(id) {
    const list = getGallery().filter((p) => p.id !== id)
    localStorage.setItem(GALLERY_KEY, JSON.stringify(list))
  }

  function buildStripFromPhotos(photos) {
    const stripPadding = 12
    const gap = 8
    const frameW = 140
    const frameH = 112
    const corner = 4
    const stripW = stripPadding * 2 + frameW
    const stripH = stripPadding * 2 + frameH * 4 + gap * 3
    const canvas = document.createElement('canvas')
    canvas.width = stripW
    canvas.height = stripH
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#e8e8e8'
    ctx.fillRect(0, 0, stripW, stripH)
    const loadImg = (src) =>
      new Promise((res, rej) => {
        const i = new Image()
        i.onload = () => res(i)
        i.onerror = rej
        i.src = src
      })
    return Promise.all(photos.map(loadImg)).then((images) => {
      for (let i = 0; i < 4; i++) {
        const x = stripPadding
        const y = stripPadding + i * (frameH + gap)
        const w = frameW
        const h = frameH
        if (i > 0) drawSerration(ctx, y - gap / 2, stripPadding, stripPadding + frameW, 3)
        ctx.fillStyle = '#f5f5f5'
        roundRect(ctx, x, y, w, h, corner)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 1
        roundRect(ctx, x, y, w, h, corner)
        ctx.stroke()
        const pad = 5
        ctx.save()
        roundRect(ctx, x + pad, y + pad, w - pad * 2, h - pad * 2, corner - 1)
        ctx.clip()
        const img = images[i]
        const iw = img.width
        const ih = img.height
        const destAspect = (w - pad * 2) / (h - pad * 2)
        const srcAspect = iw / ih
        let sx, sy, sw, sh
        if (destAspect > srcAspect) {
          sh = ih
          sw = ih * destAspect
          sx = (iw - sw) / 2
          sy = 0
        } else {
          sw = iw
          sh = iw / destAspect
          sx = 0
          sy = (ih - sh) / 2
        }
        ctx.drawImage(img, sx, sy, sw, sh, x + pad, y + pad, w - pad * 2, h - pad * 2)
        ctx.restore()
      }
      drawSerration(ctx, stripPadding + 4 * frameH + 3 * gap - gap / 2, stripPadding, stripPadding + frameW, 3)
      return canvas.toDataURL('image/png')
    })
  }

  let state = {
    mode: 'polaroid',
    stream: null,
    captured: null,
    error: null,
    stripAnimated: false,
    stripPhotos: [],
    stripPreviewUrl: null,
    polaroidPreviewUrl: null,
    decorateMode: false,
    stickers: [],
    selectedStickerId: null,
    draggingStickerId: null,
    dragOffset: { x: 0, y: 0 },
    countdown: null,
    canTakeStripPhoto: true,
    polaroidSaveConfirm: false,
    savedToast: false,
    galleryPhotos: getGallery(),
    expandedGalleryId: null,
    lastRemovedGalleryPhoto: null,
    stripCountdownId: null,
  }

  const $ = (sel, el = document) => el.querySelector(sel)
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)]

  function render() {
    const container = $('#photobooth-app')
    if (!container) return

    const previewUrl = state.stripPreviewUrl || state.polaroidPreviewUrl
    const showDecorate = state.decorateMode && previewUrl
    const showCamera = !state.captured && !showDecorate
    const showResult = state.captured

    container.innerHTML = `
      <div class="pb-page">
        <div class="pb-header">
          <h2 class="pb-title">Photobooth</h2>
          <p class="pb-desc">Capture your favorite memories</p>
        </div>

        ${state.polaroidSaveConfirm ? `
          <div class="pb-confirm-overlay">
            <div class="pb-confirm">
              <p>Do you want to save this photo?</p>
              <div class="pb-confirm-actions">
                <button type="button" class="pb-btn pb-btn-primary" data-action="confirm-save">Save</button>
                <button type="button" class="pb-btn pb-btn-secondary" data-action="confirm-nosave">Don't save</button>
              </div>
            </div>
          </div>
        ` : ''}

        ${state.error ? `<p class="pb-error">${state.error}</p>` : ''}

        <div class="pb-stage">
          <div class="pb-tabs">
            <button type="button" class="pb-tab ${state.mode === 'polaroid' ? 'active' : ''}" data-mode="polaroid">Polaroid</button>
            <button type="button" class="pb-tab ${state.mode === 'strip' ? 'active' : ''}" data-mode="strip">Photo strip</button>
          </div>

          <div class="pb-layout">
            <div class="pb-area">
              ${showDecorate ? `
                <div class="pb-decorate">
                  <p class="pb-decorate-title">⋆ Let's decorate ⋆</p>
                  <div class="pb-strip-preview" id="strip-preview">
                    <img src="${previewUrl}" alt="Preview" />
                    ${state.stickers.map((st) => `
                      <div class="pb-sticker-overlay ${state.selectedStickerId === st.id ? 'selected' : ''}"
                        style="left:${st.x*100}%;top:${st.y*100}%"
                        data-id="${st.id}">
                        <span class="pb-sticker-emoji">${st.emoji}</span>
                        ${state.selectedStickerId === st.id ? `<button type="button" class="pb-sticker-remove" data-id="${st.id}">×</button>` : ''}
                      </div>
                    `).join('')}
                  </div>
                  <div class="pb-sticker-palette">
                    ${Object.entries(STICKER_CATEGORIES).map(([label, emojis]) => `
                      <div class="pb-sticker-cat">
                        <span class="pb-sticker-label">${label}</span>
                        <div class="pb-sticker-btns">
                          ${emojis.map((e) => `<button type="button" class="pb-sticker-btn" data-emoji="${e}">${e}</button>`).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                  <div class="pb-decorate-actions">
                    <button type="button" class="pb-btn pb-btn-secondary" data-action="back-decorate">← Back</button>
                    <button type="button" class="pb-btn pb-btn-primary" data-action="finish-decorate">Done</button>
                  </div>
                </div>
              ` : ''}

              ${showCamera ? `
                <div class="pb-camera-view">
                  <div class="pb-camera-wrap">
                    <video id="pb-video" autoplay playsinline muted></video>
                    ${state.mode === 'strip' && state.countdown !== null ? `<div class="pb-countdown">${state.countdown}</div>` : ''}
                  </div>
                  ${state.mode === 'strip' ? `
                    <div class="pb-strip-controls">
                      ${state.stripPhotos.length < STRIP_PHOTO_COUNT ? `<p class="pb-strip-progress">Photo ${state.stripPhotos.length + 1} of ${STRIP_PHOTO_COUNT}</p>` : ''}
                      <div class="pb-strip-btns">
                        ${state.stripPhotos.length > 0 && state.stripPhotos.length < STRIP_PHOTO_COUNT ? `<button type="button" class="pb-btn pb-btn-secondary" data-action="redo-strip">Redo last</button>` : ''}
                        <button type="button" class="pb-btn pb-btn-capture" data-action="capture-strip"
                          ${!state.stream || !state.canTakeStripPhoto || state.stripPhotos.length >= STRIP_PHOTO_COUNT ? 'disabled' : ''}>
                          ${state.stripPhotos.length >= STRIP_PHOTO_COUNT ? 'Processing…' : 'Take photo'}
                        </button>
                      </div>
                    </div>
                  ` : `
                    <button type="button" class="pb-btn pb-btn-capture" data-action="capture-polaroid" ${!state.stream ? 'disabled' : ''}>Capture</button>
                  `}
                </div>
              ` : ''}

              ${showResult ? `
                <div class="pb-result-view">
                  <div class="pb-booth-result">
                    <div class="pb-booth-machine">
                      <div class="pb-booth-curtain"></div>
                      <div class="pb-booth-slot">
                        <div class="pb-booth-strip ${state.stripAnimated ? 'out' : ''}">
                          <img src="${state.captured}" alt="Result" />
                        </div>
                      </div>
                    </div>
                    ${state.savedToast ? '<p class="pb-saved-toast">Saved to gallery!</p>' : ''}
                    <div class="pb-result-actions">
                      <button type="button" class="pb-btn pb-btn-secondary" data-action="save-gallery">Save to gallery</button>
                      <a href="${state.captured}" download="photobooth-${state.mode}-${Date.now()}.png" class="pb-btn pb-btn-primary">Download</a>
                      <button type="button" class="pb-btn pb-btn-secondary" data-action="reset">Take another</button>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>

            <aside class="pb-gallery">
              <h3 class="pb-gallery-title">Gallery</h3>
              ${state.lastRemovedGalleryPhoto ? `
                <div class="pb-gallery-undo">
                  <button type="button" class="pb-btn pb-btn-secondary" data-action="undo-remove">Undo remove</button>
                </div>
              ` : ''}
              ${state.galleryPhotos.length === 0 ? '<p class="pb-gallery-empty">Save photos here from the booth.</p>' : `
                <div class="pb-gallery-list">
                  ${state.galleryPhotos.map((p) => `
                    <div class="pb-gallery-item ${state.expandedGalleryId === p.id ? 'expanded' : ''}">
                      <div class="pb-gallery-thumb" data-expand="${p.id}">
                        <img src="${p.imageData}" alt="${p.type}" />
                        <span class="pb-gallery-type">${p.type}</span>
                      </div>
                      ${state.expandedGalleryId === p.id ? `
                        <div class="pb-gallery-detail">
                          <button type="button" class="pb-btn pb-btn-secondary" data-action="remove-gallery" data-id="${p.id}">Remove</button>
                          <a href="${p.imageData}" download="photobooth-${p.type}-${p.id}.png" class="pb-btn pb-btn-secondary">Download</a>
                        </div>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              `}
            </aside>
          </div>
        </div>

        <div class="pb-bubbles" aria-hidden="true">
          ${Array.from({ length: 40 }, (_, i) => `<span class="pb-bubble pb-bubble-${i + 1}"></span>`).join('')}
        </div>
      </div>
      <canvas id="pb-canvas" style="display:none"></canvas>
    `

    bindEvents()
    setupVideo()
  }

  function bindEvents() {
    $$('[data-action]', $('#photobooth-app')).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action
        const id = btn.dataset.id
        if (action === 'confirm-save') {
          if (state.captured) saveToGallery({ imageData: state.captured, type: state.mode })
          state.polaroidSaveConfirm = false
          reset()
          state.mode = 'strip'
        } else if (action === 'confirm-nosave') {
          state.polaroidSaveConfirm = false
          reset()
          state.mode = 'strip'
        } else if (action === 'back-decorate') {
          state.stripPreviewUrl = null
          state.polaroidPreviewUrl = null
          state.decorateMode = false
          state.stickers = []
          state.selectedStickerId = null
        } else if (action === 'finish-decorate') {
          finishDecorate()
        } else if (action === 'capture-polaroid') {
          capturePolaroid()
        } else if (action === 'capture-strip') {
          startStripCountdown()
        } else if (action === 'redo-strip') {
          state.stripPhotos = state.stripPhotos.slice(0, -1)
          state.canTakeStripPhoto = true
        } else if (action === 'save-gallery') {
          if (state.captured) {
            saveToGallery({ imageData: state.captured, type: state.mode })
            state.galleryPhotos = getGallery()
            state.savedToast = true
            setTimeout(() => { state.savedToast = false; render() }, 2000)
          }
        } else if (action === 'reset') {
          reset()
        } else if (action === 'undo-remove') {
          if (state.lastRemovedGalleryPhoto) {
            saveToGallery(state.lastRemovedGalleryPhoto)
            state.galleryPhotos = getGallery()
            state.lastRemovedGalleryPhoto = null
          }
        } else if (action === 'remove-gallery') {
          const p = state.galleryPhotos.find((x) => x.id === id)
          if (p) state.lastRemovedGalleryPhoto = p
          removeFromGallery(id)
          state.galleryPhotos = getGallery()
          if (state.expandedGalleryId === id) state.expandedGalleryId = null
        }
        render()
      })
    })

    $$('[data-mode]', $('#photobooth-app')).forEach((tab) => {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.mode
        if (mode === state.mode) return
        if (state.captured && state.mode === 'polaroid' && mode === 'strip') {
          state.polaroidSaveConfirm = true
        } else {
          state.mode = mode
          state.stripPhotos = []
          state.countdown = null
          state.canTakeStripPhoto = true
          if (state.stripCountdownId) clearInterval(state.stripCountdownId)
        }
        render()
      })
    })

    $$('.pb-sticker-btn', $('#photobooth-app')).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.stickers.push({ id: crypto.randomUUID(), emoji: btn.dataset.emoji, x: 0.5, y: 0.5 })
        render()
      })
    })

    $$('.pb-sticker-overlay', $('#photobooth-app')).forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
        state.selectedStickerId = el.dataset.id
        const st = state.stickers.find((s) => s.id === el.dataset.id)
        const preview = $('#strip-preview')
        if (st && preview) {
          const rect = preview.getBoundingClientRect()
          state.draggingStickerId = st.id
          state.dragOffset = { x: e.clientX - (rect.left + st.x * rect.width), y: e.clientY - (rect.top + st.y * rect.height) }
        }
        render()
      })
    })

    $$('.pb-sticker-remove', $('#photobooth-app')).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        state.stickers = state.stickers.filter((s) => s.id !== btn.dataset.id)
        state.selectedStickerId = null
        render()
      })
    })

    $$('[data-expand]', $('#photobooth-app')).forEach((el) => {
      el.addEventListener('click', () => {
        state.expandedGalleryId = state.expandedGalleryId === el.dataset.expand ? null : el.dataset.expand
        render()
      })
    })

    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedStickerId && state.decorateMode) {
        e.preventDefault()
        state.stickers = state.stickers.filter((s) => s.id !== state.selectedStickerId)
        state.selectedStickerId = null
        render()
      }
    })

    const preview = $('#strip-preview')
    if (preview && !window._pbDragBound) {
      window._pbDragBound = true
      document.addEventListener('mousemove', (e) => {
        if (!state.draggingStickerId) return
        const st = state.stickers.find((s) => s.id === state.draggingStickerId)
        const p = document.getElementById('strip-preview')
        if (!st || !p) return
        const rect = p.getBoundingClientRect()
        const x = (e.clientX - state.dragOffset.x - rect.left) / rect.width
        const y = (e.clientY - state.dragOffset.y - rect.top) / rect.height
        st.x = Math.max(0.1, Math.min(0.9, x))
        st.y = Math.max(0.1, Math.min(0.9, y))
        const el = document.querySelector(`.pb-sticker-overlay[data-id="${st.id}"]`)
        if (el) {
          el.style.left = (st.x * 100) + '%'
          el.style.top = (st.y * 100) + '%'
        }
      })
      document.addEventListener('mouseup', () => { state.draggingStickerId = null })
    }
  }

  function setupVideo() {
    const video = document.getElementById('pb-video')
    if (!video || state.captured || state.decorateMode) return
    if (state.stream) {
      video.srcObject = state.stream
      video.play().catch(() => {})
      return
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => {
        state.stream = stream
        state.error = null
        video.srcObject = stream
        video.play().catch(() => {})
        render()
      })
      .catch(() => {
        state.error = 'Camera access needed. Allow camera and refresh.'
        render()
      })
  }

  function capturePolaroid() {
    const video = $('#pb-video')
    const canvas = $('#pb-canvas')
    if (!video || !canvas || !state.stream) return
    const ctx = canvas.getContext('2d')
    canvas.width = 320
    canvas.height = 400
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = 14
    ctx.shadowOffsetY = 8
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, 320, 400)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    drawVideoCover(ctx, video, 20, 20, 280, 280)
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 300, 320, 100)
    state.polaroidPreviewUrl = canvas.toDataURL('image/png')
    state.decorateMode = true
    render()
  }

  function startStripCountdown() {
    if (state.stripPhotos.length >= STRIP_PHOTO_COUNT || !state.canTakeStripPhoto || state.countdown !== null) return
    state.canTakeStripPhoto = false
    state.countdown = 3
    render()
    state.stripCountdownId = setInterval(() => {
      state.countdown--
      render()
      if (state.countdown === 0) {
        clearInterval(state.stripCountdownId)
        state.stripCountdownId = null
        captureOneStripPhoto()
      }
    }, 1000)
  }

  function captureOneStripPhoto() {
    const video = $('#pb-video')
    const canvas = $('#pb-canvas')
    if (!video || !canvas || !state.stream) return
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    state.stripPhotos = [...state.stripPhotos, dataUrl]
    state.canTakeStripPhoto = true
    if (state.stripPhotos.length >= STRIP_PHOTO_COUNT) {
      buildStripFromPhotos(state.stripPhotos).then((stripDataUrl) => {
        state.stripPreviewUrl = stripDataUrl
        state.decorateMode = true
        state.stickers = []
        state.stripPhotos = []
        render()
      })
    }
    render()
  }

  function finishDecorate() {
    const previewUrl = state.stripPreviewUrl || state.polaroidPreviewUrl
    if (!previewUrl) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      ctx.font = '36px "Apple Color Emoji", "Segoe UI Emoji", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      state.stickers.forEach((st) => ctx.fillText(st.emoji, st.x * img.width, st.y * img.height))
      state.captured = canvas.toDataURL('image/png')
      state.stripPreviewUrl = null
      state.polaroidPreviewUrl = null
      state.decorateMode = false
      state.stickers = []
      state.selectedStickerId = null
      state.stripAnimated = false
      setTimeout(() => { state.stripAnimated = true; render() }, 150)
      render()
    }
    img.src = previewUrl
  }

  function reset() {
    if (state.stream) {
      state.stream.getTracks().forEach((t) => t.stop())
      state.stream = null
    }
    state.captured = null
    state.stripAnimated = false
    state.stripPhotos = []
    state.stripPreviewUrl = null
    state.polaroidPreviewUrl = null
    state.decorateMode = false
    state.countdown = null
    state.canTakeStripPhoto = true
    state.selectedStickerId = null
    state.draggingStickerId = null
    if (state.stripCountdownId) clearInterval(state.stripCountdownId)
    const video = document.getElementById('pb-video')
    if (video) video.srcObject = null
    render()
  }

  function init() {
    state.galleryPhotos = getGallery()
    render()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  window.photoboothReset = reset
})()
