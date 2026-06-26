!(function (t, e) {
  'object' == typeof exports && 'undefined' != typeof module
    ? e(exports)
    : 'function' == typeof define && define.amd
      ? define(['exports'], e)
      : e(
          ((t =
            'undefined' != typeof globalThis ? globalThis : t || self).AgentAI =
            {}),
        );
})(this, function (t) {
  'use strict';
  const e = (t) => {
      const e = document.createElement('div');
      return (
        [
          'script',
          'noscript',
          'style',
          'nav',
          'footer',
          '.ads',
          '.sidebar',
          '.popup',
          '.cookie-banner',
          '#ibl-chat-widget-container',
          '.ibl-chat-bubble',
          'mentor-ai',
        ].forEach((n) => {
          e.innerHTML = t;
          e.querySelectorAll(n).forEach((t) => t.remove());
        }),
        e.innerHTML.replace(/\n/g, '')
      );
    },
    n = new Blob(
      [
        '\n    const cleanElement = (htmlString) => {\n      const selectorsToRemove = [\n        "script",\n        "noscript",\n        "style",\n        "nav",\n        "footer",\n        ".ads",\n        ".sidebar",\n        ".popup",\n        ".cookie-banner",\n        "#ibl-chat-widget-container",\n        ".ibl-chat-bubble",\n        "mentor-ai",\n        "link",\n        "meta",\n        "iframe",\n      ];\n\n      let cleanedHTML = htmlString;\n      \n      // Remove HTML comments\n      cleanedHTML = cleanedHTML.replace(/\x3c!--.*?--\x3e/gs, "");\n      cleanedHTML = cleanedHTML.replace("\\n", "");\n      // Remove elements by tag name\n      selectorsToRemove\n        .filter((selector) => !selector.startsWith(".") && !selector.startsWith("#"))\n        .forEach((tag) => {\n          const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, "gs");\n          cleanedHTML = cleanedHTML.replace(regex, "");\n        });\n\n      // Remove elements by class or ID\n      selectorsToRemove\n        .filter((selector) => selector.startsWith(".") || selector.startsWith("#"))\n        .forEach((attr) => {\n          const attrType = attr.startsWith(".") ? "class" : "id";\n          const attrName = attr.slice(1);\n\n          // Remove elements with matching class or ID\n          const regex = new RegExp(`<[^>]*\\s${attrType}=["\'][^"\']*\\b${attrName}\\b[^"\']*["\'][^>]*>.*?</[^>]+>`, "gs");\n          cleanedHTML = cleanedHTML.replace(regex, "");\n\n          // Remove attributes inside tags (e.g., `<div class="ads">` → `<div>`)\n          const attrRegex = new RegExp(`\\s${attrType}=["\'][^"\']*\\b${attrName}\\b[^"\']*["\']`, "gs");\n          cleanedHTML = cleanedHTML.replace(attrRegex, "");\n        });\n\n      // Remove newline characters and extra spaces\n      return cleanedHTML.replace(/\\n/g, "").trim();\n    };\n    onmessage = function (event) {\n      const htmlContent = event.data; // Get the HTML content from the main thread\n      const cleanedContent = cleanElement(htmlContent); // Clean the content\n      postMessage(cleanedContent); // Send the cleaned content back to the main thread\n    }\n    ',
      ],
      { type: 'application/javascript' },
    ),
    o = URL.createObjectURL(n);
  async function s(t, e) {
    const n = {};
    e && (n.Authorization = `JWT ${e}`);
    const o = await fetch(`${t}/api/ibl/users/manage/platform/`, {
      credentials: 'include',
      headers: n,
    });
    if (!o.ok) throw new Error('Network response was not ok');
    return await o.json();
  }
  async function i(t, e, n) {
    const o = new FormData();
    o.append('platform_key', e);
    const s = {};
    n && (s.Authorization = `JWT ${n}`);
    const i = await fetch(`${t}/api/ibl/manager/consolidated-token/proxy/`, {
      method: 'POST',
      credentials: 'include',
      headers: s,
      body: o,
    });
    if (!i.ok) throw new Error('Network response was not ok');
    return (await i.json()).data;
  }
  const a = 'mentor-ai-popup-id',
    r = 'mentor-ai-screen-sharing-active';
  class d extends HTMLElement {
    constructor() {
      super(),
        (this.isEmbeddedMentorReady = !1),
        (this.iblData = ''),
        (this.lastUrl = ''),
        (this.iframeContexts = {}),
        (this.userObject = null),
        (this.popupWindow = null),
        (this.sentOpenNewWindowForScreenShare = !1),
        (this.isMicMuted = !1),
        (this.isMicSpeaking = !1),
        (this.isMentorMuted = !1),
        (this.isMentorSpeaking = !1);
      const t = new URL(window.location.href).searchParams.get('ibl-data');
      t && (this.iblData = t), this.attachShadow({ mode: 'open' });
      this.shadowRoot &&
        (this.shadowRoot.innerHTML =
          '\n    <style>\n        iframe {\n        border: 0px white;\n        height: 100%;\n        width: 100%;\n        border-radius: 0;\n        }\n        #ibl-chat-widget-container {\n            /* border: 1px solid #dfdfdf; */\n            height: 100%;\n            position: relative;\n        }\n        @media screen and (max-width: 768px) {\n        #ibl-chat-widget-container {\n\n        }\n        img.ibl-chat-bubble {\n            right: 20px !important;\n        }\n        }\n        .spinner {\n            border: 3px solid #f3f3f3; /* Light grey */\n            border-top: 3px solid #6cafe1; /* Blue */\n            border-radius: 50%;\n            width: 40px;\n            height: 40px;\n            animation: spin 1s linear infinite;\n            position: absolute;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            display: block; /* Initially hidden */\n        }\n\n        @keyframes spin {\n            0% { transform: rotate(0deg); }\n            100% { transform: rotate(360deg); }\n        }\n\n        #refresh-instruction {\n            display: none;\n            position: absolute;\n            top: 50%;\n            left: 50%;\n            transform: translate(-50%, -50%);\n            text-align: center;\n            font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n            color: #333;\n            padding: 20px;\n            max-width: 300px;\n        }\n\n        #refresh-instruction p {\n            margin: 0 0 15px 0;\n            font-size: 14px;\n            line-height: 1.5;\n        }\n\n        #refresh-instruction button {\n            background-color: #6cafe1;\n            color: white;\n            border: none;\n            padding: 10px 20px;\n            border-radius: 5px;\n            cursor: pointer;\n            font-size: 14px;\n        }\n\n        #refresh-instruction button:hover {\n            background-color: #5a9fd4;\n        }\n\n        #screensharing-overlay {\n            display: none;\n            position: absolute;\n            top: 0;\n            left: 0;\n            right: 0;\n            bottom: 0;\n            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);\n            z-index: 100;\n            flex-direction: column;\n            align-items: center;\n            justify-content: center;\n            text-align: center;\n            font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n            color: white;\n            padding: 20px;\n            box-sizing: border-box;\n        }\n\n        #screensharing-overlay.active {\n            display: flex;\n        }\n\n        #screensharing-overlay .icon {\n            width: 80px;\n            height: 80px;\n            margin-bottom: 20px;\n            background: rgba(255, 255, 255, 0.2);\n            border-radius: 50%;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n        }\n\n        #screensharing-overlay .icon svg {\n            width: 40px;\n            height: 40px;\n            fill: white;\n        }\n\n        #screensharing-overlay h2 {\n            margin: 0 0 10px 0;\n            font-size: 24px;\n            font-weight: 600;\n        }\n\n        #screensharing-overlay p {\n            margin: 0 0 25px 0;\n            font-size: 14px;\n            opacity: 0.9;\n            line-height: 1.5;\n        }\n\n        #screensharing-overlay .pulse-indicator {\n            display: flex;\n            align-items: center;\n            gap: 8px;\n            margin-bottom: 25px;\n            font-size: 14px;\n        }\n\n        #screensharing-overlay .pulse-dot {\n            width: 12px;\n            height: 12px;\n            background-color: #4ade80;\n            border-radius: 50%;\n            animation: pulse 1.5s ease-in-out infinite;\n        }\n\n        @keyframes pulse {\n            0%, 100% { opacity: 1; transform: scale(1); }\n            50% { opacity: 0.5; transform: scale(1.2); }\n        }\n\n        #screensharing-overlay button {\n            background-color: rgba(255, 255, 255, 0.2);\n            color: white;\n            border: 2px solid white;\n            padding: 12px 24px;\n            border-radius: 8px;\n            cursor: pointer;\n            font-size: 14px;\n            font-weight: 500;\n            transition: all 0.2s ease;\n        }\n\n        #screensharing-overlay button:hover {\n            background-color: white;\n            color: #764ba2;\n        }\n\n        /* Audio Status UI */\n        #screensharing-overlay .audio-status-container {\n            display: flex;\n            flex-direction: column;\n            gap: 12px;\n            margin-top: 30px;\n            padding: 16px 24px;\n            background: rgba(0, 0, 0, 0.3);\n            border-radius: 12px;\n            min-width: 260px;\n        }\n\n        #screensharing-overlay .status-row {\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            gap: 16px;\n        }\n\n        #screensharing-overlay .status-indicator {\n            display: flex;\n            align-items: center;\n            gap: 8px;\n        }\n\n        #screensharing-overlay .status-dot {\n            width: 10px;\n            height: 10px;\n            border-radius: 50%;\n            background-color: #3b82f6;\n            flex-shrink: 0;\n        }\n\n        #screensharing-overlay .status-dot.speaking {\n            background-color: #22c55e;\n            box-shadow: 0 0 12px 4px rgba(34, 197, 94, 0.6);\n            animation: speakingPulse 1s ease-in-out infinite;\n        }\n\n        #screensharing-overlay .status-dot.muted {\n            background-color: #ef4444;\n        }\n\n        @keyframes speakingPulse {\n            0%, 100% { box-shadow: 0 0 12px 4px rgba(34, 197, 94, 0.6); }\n            50% { box-shadow: 0 0 20px 8px rgba(34, 197, 94, 0.4); }\n        }\n\n        #screensharing-overlay .status-text {\n            font-size: 14px;\n            font-weight: 500;\n            color: white;\n        }\n\n        #screensharing-overlay .status-text.speaking {\n            color: #4ade80;\n        }\n\n        #screensharing-overlay .audio-action-btn {\n            width: 40px;\n            height: 40px;\n            border-radius: 50%;\n            background: rgba(255, 255, 255, 0.15);\n            border: none;\n            display: flex;\n            align-items: center;\n            justify-content: center;\n            cursor: pointer;\n            transition: all 0.2s ease;\n            flex-shrink: 0;\n        }\n\n        #screensharing-overlay .audio-action-btn:hover {\n            background: rgba(255, 255, 255, 0.25);\n        }\n\n        #screensharing-overlay .audio-action-btn.muted {\n            background: rgba(239, 68, 68, 0.2);\n        }\n\n        #screensharing-overlay .audio-action-btn svg {\n            width: 20px;\n            height: 20px;\n            fill: rgba(255, 255, 255, 0.8);\n        }\n\n        #screensharing-overlay .audio-action-btn.muted svg {\n            fill: #ef4444;\n        }\n    </style>\n    <div id="ibl-chat-widget-container">\n        <div class="spinner" id="loading-spinner"></div>\n        <div id="refresh-instruction"></div>\n        <div id="screensharing-overlay">\n            <div class="icon">\n                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n                    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v2h12v-2l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>\n                </svg>\n            </div>\n            <h2>Screen Sharing Active</h2>\n            <div class="pulse-indicator">\n                <span class="pulse-dot"></span>\n                <span>Your screen is being shared</span>\n            </div>\n            <p>The mentor can now see your screen in the popup window.</p>\n            <button id="stop-screensharing-btn">Stop Screen Sharing</button>\n            <div class="audio-status-container" id="audio-status-container">\n                <div class="status-row">\n                    <div class="status-indicator">\n                        <span class="status-dot" id="mentor-status-dot"></span>\n                        <span class="status-text" id="mentor-status-text">Mentor audio on</span>\n                    </div>\n                    <div class="audio-action-btn" id="mentor-audio-btn">\n                        <svg id="mentor-icon-on" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>\n                        </svg>\n                        <svg id="mentor-icon-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="display: none;">\n                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>\n                        </svg>\n                    </div>\n                </div>\n                <div class="status-row">\n                    <div class="status-indicator">\n                        <span class="status-dot" id="mic-status-dot"></span>\n                        <span class="status-text" id="mic-status-text">Mic on</span>\n                    </div>\n                    <div class="audio-action-btn" id="mic-audio-btn">\n                        <svg id="mic-icon-on" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">\n                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>\n                        </svg>\n                        <svg id="mic-icon-muted" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="display: none;">\n                            <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20c0 .55.45 1 1 1s1-.45 1-1v-2.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>\n                        </svg>\n                    </div>\n                </div>\n            </div>\n        </div>\n        <iframe\n          sandbox="allow-scripts allow-same-origin"\n          allow="clipboard-read; clipboard-write; microphone *; camera *; midi *; geolocation *; encrypted-media *; display-capture *"\n          onload="this.parentNode.querySelector(\'#loading-spinner\').style.display=\'none\';"\n          onloadstart="this.parentNode.querySelector(\'#loading-spinner\').style.display=\'block\';"\n        ></iframe>\n    </div>\n        ');
    }
    async onPostMessage(t) {
      var e, n;
      let o = t.data;
      if ('string' == typeof o)
        try {
          o = JSON.parse(o);
        } catch (t) {
          return;
        }
      if ('context' === (null == o ? void 0 : o.type)) {
        const e = t.origin;
        this.contextOrigins.includes(e) && (this.iframeContexts[e] = o.data);
      }
      if (
        'MENTOR:CHAT_ACTION_VOICECALL' === (null == o ? void 0 : o.type) ||
        'MENTOR:CHAT_ACTION_SCREENSHARE' === (null == o ? void 0 : o.type)
      ) {
        const t =
          null === (e = this.shadowRoot) || void 0 === e
            ? void 0
            : e.querySelector('iframe');
        if (t && t.src) {
          let e = '';
          'MENTOR:CHAT_ACTION_VOICECALL' === (null == o ? void 0 : o.type)
            ? (e = 'voice-call')
            : 'MENTOR:CHAT_ACTION_SCREENSHARE' ===
                (null == o ? void 0 : o.type) && (e = 'screen-share');
          let n = this.iblData;
          if (!n && this.userObject) {
            const t = {};
            for (const e in this.userObject)
              'tenants' !== e && (t[e] = this.userObject[e]);
            n = JSON.stringify(t);
          }
          const s = `${t.src}&ibl-data=${n}&chat-action=${e}&session-id=${null == o ? void 0 : o.sessionId}`;
          if (this.isInIframe())
            'MENTOR:CHAT_ACTION_SCREENSHARE' ===
              (null == o ? void 0 : o.type) &&
              (this.sentOpenNewWindowForScreenShare = !0),
              window.parent.postMessage(
                { type: 'ACTION:OPEN_NEW_WINDOW', payload: { url: s } },
                '*',
              );
          else {
            'MENTOR:CHAT_ACTION_SCREENSHARE' ===
              (null == o ? void 0 : o.type) &&
              (this.sentOpenNewWindowForScreenShare = !0);
            const t = 375,
              e = 667,
              n = (window.screen.width - t) / 2,
              i = (window.screen.height - e) / 2,
              r = `MentorAI_${Date.now()}`,
              d = window.open(
                s,
                r,
                `width=${t},height=${e},left=${n},top=${i},toolbar=no,location=no,directories=no,status=no,menubar=no,resizable=yes,scrollbars=yes`,
              );
            d &&
              (localStorage.setItem(a, r), d.focus(), (this.popupWindow = d));
          }
        }
      }
      if (
        ((null == o ? void 0 : o.closeEmbed) &&
          window.parent.postMessage(JSON.stringify(o), '*'),
        null == o ? void 0 : o.height)
      ) {
        const t =
          null === (n = this.shadowRoot) || void 0 === n
            ? void 0
            : n.querySelector('#ibl-chat-widget-container');
        t && (t.style.height = `${o.height}px`);
      }
      if (
        ('MENTOR:SCREENSHARING_STARTED' === (null == o ? void 0 : o.type) &&
          (this.sentOpenNewWindowForScreenShare ||
            'true' === localStorage.getItem(r)) &&
          (localStorage.setItem(r, 'true'), this.showScreenSharingOverlay()),
        'MENTOR:SCREENSHARING_STOPPED' === (null == o ? void 0 : o.type) &&
          this.sentOpenNewWindowForScreenShare &&
          this.stopScreenSharing(),
        'MENTOR:SCREENSHARING_SPEAKING' === (null == o ? void 0 : o.type) &&
          this.updateMicSpeakingState(o.speaking),
        'MENTOR:SCREENSHARING_MUTED' === (null == o ? void 0 : o.type) &&
          this.updateMicMutedState(o.muted),
        'MENTOR:SCREENSHARING_MENTOR_SPEAKING' ===
          (null == o ? void 0 : o.type) &&
          this.updateMentorSpeakingState(o.speaking),
        'MENTOR:SCREENSHARING_MENTOR_MUTED' === (null == o ? void 0 : o.type) &&
          this.updateMentorMutedState(o.muted),
        'MENTOR:FOCUS_PARENT' === (null == o ? void 0 : o.type) &&
          window.focus(),
        !this.isAnonymous)
      ) {
        if (null == o ? void 0 : o.authExpired)
          try {
            const t = this.getEdxJwtToken(),
              e = await s(this.lmsUrl, t),
              n = e.find((t) => t.key === this.tenant);
            if (n) {
              const o = await i(this.lmsUrl, n.key, t);
              (this.userObject = {
                axd_token: o.axd_token.token,
                axd_token_expires: o.axd_token.expires,
                userData: JSON.stringify(o.user),
                dm_token_expires: o.dm_token.expires,
                edx_jwt_token: t,
                tenant: n.key,
                tenants: JSON.stringify(e),
                dm_token: o.dm_token.token,
              }),
                this.sendAuthDataToIframe(this.userObject);
            }
          } catch (t) {
            console.error('Error fetching user tenants or tokens:', t),
              this.authRelyOnHost
                ? this.showRefreshInstruction()
                : this.redirectToAuthSPA();
          }
        if ((null == o ? void 0 : o.loaded) && o.auth.userData)
          try {
            if (
              this.edxUserId &&
              this.edxUserId != JSON.parse(o.auth.userData).user_id.toString()
            )
              if (this.iblData) this.sendAuthDataToIframe(this.iblData);
              else
                try {
                  const t = this.getEdxJwtToken(),
                    e = await s(this.lmsUrl, t),
                    n = e.find((t) => t.key === this.tenant);
                  if (n) {
                    const o = await i(this.lmsUrl, n.key, t);
                    (this.userObject = {
                      axd_token: o.axd_token.token,
                      axd_token_expires: o.axd_token.expires,
                      userData: JSON.stringify(o.user),
                      dm_token_expires: o.dm_token.expires,
                      edx_jwt_token: t,
                      tenant: n.key,
                      tenants: JSON.stringify(e),
                      dm_token: o.dm_token.token,
                    }),
                      this.sendAuthDataToIframe(this.userObject);
                  }
                } catch (t) {
                  this.authRelyOnHost
                    ? this.showRefreshInstruction()
                    : this.redirectToAuthSPA();
                }
            else
              this.userObject = {
                axd_token: o.auth.axd_token,
                axd_token_expires: o.auth.axd_token_expires,
                userData: o.auth.userData,
                dm_token_expires: o.auth.dm_token_expires,
                edx_jwt_token: o.auth.edx_jwt_token,
                tenant: o.auth.tenant,
                tenants: o.auth.tenants,
                dm_token: o.auth.dm_token,
              };
          } catch (t) {
            console.error('Error parsing userData from auth:', t);
          }
      }
      (null == o ? void 0 : o.ready) &&
        ((this.isEmbeddedMentorReady = !0),
        this.iblData
          ? this.sendAuthDataToIframe(this.iblData)
          : this.authRelyOnHost ||
            this.isAnonymous ||
            this.redirectToAuthSPA()),
        (null == o ? void 0 : o.loaded) &&
          ((this.isEmbeddedMentorReady = !0),
          this.isContextAware && this.sendHostInfoToIframe(),
          this.theme && this.switchTheme(this.theme),
          this.documentFilter && this.sendDocumentFilterToIframe(),
          this.enableChatActionPopup &&
            this.sendDataToIframe({
              type: 'MENTOR:ENABLE_CHAT_ACTION_POPUPS',
              payload: { enable: !0 },
            }),
          this.edxUsageId &&
            this.sendDataToIframe({
              type: 'MENTOR:EDX_USAGE_ID',
              data: { edxUsageId: this.edxUsageId },
            }),
          this.edxCourseId &&
            this.sendDataToIframe({
              type: 'MENTOR:EDX_COURSE_ID',
              data: { edxCourseId: this.edxCourseId },
            }));
    }
    connectedCallback() {
      var t, e, n, o;
      if (this.contextSettings) return void this.renderContextSettingsView();
      if (this.iblData) {
        const t = new URL(window.location.href);
        t.searchParams.delete('ibl-data'),
          window.history.replaceState({}, document.title, t);
      }
      if (
        (!this.iblData &&
          this.authRelyOnHost &&
          'undefined' != typeof localStorage &&
          localStorage.getItem('axd_token') &&
          localStorage.getItem('dm_token') &&
          localStorage.getItem('tenants') &&
          (this.iblData = JSON.stringify({
            axd_token: localStorage.getItem('axd_token'),
            dm_token: localStorage.getItem('dm_token'),
            tenants: localStorage.getItem('tenants'),
            tenant: localStorage.getItem('tenant'),
            userData: localStorage.getItem('userData'),
            edx_jwt_token: localStorage.getItem('edx_jwt_token'),
            axd_token_expires: localStorage.getItem('axd_token_expires'),
            dm_token_expires: localStorage.getItem('dm_token_expires'),
          })),
        this.iblData)
      ) {
        const t = JSON.parse(this.iblData).userData;
        document.cookie = `userData=${t}; domain=${document.domain}; path=/;`;
      }
      window.addEventListener('message', (t) => this.onPostMessage(t));
      const s =
        null === (t = this.shadowRoot) || void 0 === t
          ? void 0
          : t.querySelector('iframe');
      s &&
        ((s.onloadstart = () => {
          var t;
          const e =
            null === (t = this.shadowRoot) || void 0 === t
              ? void 0
              : t.querySelector('#loading-spinner');
          e && (e.style.display = 'block');
        }),
        (s.onload = () => {
          var t;
          const e =
            null === (t = this.shadowRoot) || void 0 === t
              ? void 0
              : t.querySelector('#loading-spinner');
          e && (e.style.display = 'none');
        }));
      const i =
        null === (e = this.shadowRoot) || void 0 === e
          ? void 0
          : e.querySelector('#stop-screensharing-btn');
      i &&
        i.addEventListener('click', () => {
          this.stopScreenSharing();
        });
      const a =
        null === (n = this.shadowRoot) || void 0 === n
          ? void 0
          : n.querySelector('#mic-audio-btn');
      a &&
        a.addEventListener('click', () => {
          this.toggleMute();
        });
      const d =
        null === (o = this.shadowRoot) || void 0 === o
          ? void 0
          : o.querySelector('#mentor-audio-btn');
      d &&
        d.addEventListener('click', () => {
          this.toggleMentorMute();
        });
      if (localStorage.getItem(r))
        if (this.isInIframe())
          window.parent.postMessage(
            { type: 'MENTOR:SCREENSHARING_STATUS' },
            '*',
          );
        else {
          this.getPopupWindow()
            ? ((this.sentOpenNewWindowForScreenShare = !0),
              this.showScreenSharingOverlay())
            : localStorage.removeItem(r);
        }
    }
    disconnectedCallback() {
      window.removeEventListener('message', this.onPostMessage);
    }
    get mentorUrl() {
      return this.getAttribute('mentorurl') || 'https://mentor.iblai.app';
    }
    set mentorUrl(t) {
      this.setAttribute('mentorurl', t);
    }
    get authUrl() {
      return this.getAttribute('authurl') || 'https://auth.iblai.app';
    }
    set authUrl(t) {
      this.setAttribute('authurl', t);
    }
    get lmsUrl() {
      return this.getAttribute('lmsurl') || 'https://learn.iblai.app';
    }
    set lmsUrl(t) {
      this.setAttribute('lmsurl', t);
    }
    get theme() {
      return this.getAttribute('theme') || 'light';
    }
    set theme(t) {
      this.setAttribute('theme', t);
    }
    get tenant() {
      return this.getAttribute('tenant');
    }
    set tenant(t) {
      this.setAttribute('tenant', t);
    }
    get extraParams() {
      return this.getAttribute('extraparams');
    }
    set extraParams(t) {
      this.setAttribute('extraparams', t);
    }
    get contextOrigins() {
      var t;
      return (
        (null === (t = this.getAttribute('contextorigins')) || void 0 === t
          ? void 0
          : t.split(',')) || []
      );
    }
    set contextOrigins(t) {
      this.setAttribute('contextorigins', t);
    }
    get mentor() {
      return this.getAttribute('mentor');
    }
    set mentor(t) {
      this.setAttribute('mentor', t);
    }
    get edxUsageId() {
      return this.getAttribute('edxusageid');
    }
    set edxUsageId(t) {
      this.setAttribute('edxusageid', t);
    }
    get edxCourseId() {
      return this.getAttribute('edxcourseid');
    }
    set edxCourseId(t) {
      this.setAttribute('edxcourseid', t);
    }
    get edxUserId() {
      return this.getAttribute('edxuserid');
    }
    set edxUserId(t) {
      this.setAttribute('edxuserid', t);
    }
    get authRelyOnHost() {
      return this.hasAttribute('authrelyonhost');
    }
    set authRelyOnHost(t) {
      t
        ? this.setAttribute('authrelyonhost', '')
        : this.removeAttribute('authrelyonhost');
    }
    get isAnonymous() {
      return this.hasAttribute('isanonymous');
    }
    set isAnonymous(t) {
      t
        ? this.setAttribute('isanonymous', '')
        : this.removeAttribute('isanonymous');
    }
    get isAdvanced() {
      return this.hasAttribute('isadvanced');
    }
    set isAdvanced(t) {
      t
        ? this.setAttribute('isadvanced', '')
        : this.removeAttribute('isadvanced');
    }
    get isContextAware() {
      return this.hasAttribute('iscontextaware');
    }
    set isContextAware(t) {
      t
        ? this.setAttribute('iscontextaware', '')
        : this.removeAttribute('iscontextaware');
    }
    get enableChatActionPopup() {
      return this.hasAttribute('enablechatactionpopup');
    }
    set enableChatActionPopup(t) {
      t
        ? this.setAttribute('enablechatactionpopup', '')
        : this.removeAttribute('enablechatactionpopup');
    }
    get redirectToken() {
      return this.getAttribute('redirecttoken');
    }
    set redirectToken(t) {
      this.setAttribute('redirecttoken', t);
    }
    get component() {
      return this.getAttribute('component');
    }
    set component(t) {
      this.setAttribute('component', t);
    }
    get modal() {
      return this.getAttribute('modal');
    }
    set modal(t) {
      this.setAttribute('modal', t);
    }
    get documentFilter() {
      return this.getAttribute('documentfilter');
    }
    set documentFilter(t) {
      this.setAttribute('documentfilter', t);
    }
    get contextSettings() {
      return this.hasAttribute('contextsettings');
    }
    set contextSettings(t) {
      t
        ? this.setAttribute('contextsettings', '')
        : this.removeAttribute('contextsettings');
    }
    get contextId() {
      return this.getAttribute('contextid');
    }
    set contextId(t) {
      this.setAttribute('contextid', t);
    }
    get contextEnabled() {
      return this.hasAttribute('contextenabled');
    }
    set contextEnabled(t) {
      t
        ? this.setAttribute('contextenabled', '')
        : this.removeAttribute('contextenabled');
    }
    static get observedAttributes() {
      return [
        'mentorUrl',
        'tenant',
        'mentor',
        'isadvanced',
        'iscontextaware',
        'enablechatactionpopup',
        'contextOrigins',
        'component',
        'modal',
        'extraparams',
        'documentfilter',
      ];
    }
    attributeChangedCallback(t, e, n) {
      var o, s;
      if (
        [
          'mentorUrl',
          'tenant',
          'mentor',
          'isadvanced',
          'component',
          'modal',
          'extraparams',
        ].includes(t)
      ) {
        const t =
          null === (o = this.shadowRoot) || void 0 === o
            ? void 0
            : o.querySelector('iframe');
        this.shadowRoot &&
          t &&
          (t.src = `${this.mentorUrl}/platform/${this.tenant}${((t, e) => {
            switch (t) {
              case 'analytics-overview':
                return `/${e}/analytics`;
              case 'analytics-users':
                return `/${e}/analytics/users`;
              case 'analytics-topics':
                return `/${e}/analytics/topics`;
              case 'prompt-gallery':
                return `/${e}/prompt-gallery`;
              case 'explore':
                return '/explore';
              default:
                return `/${e}`;
            }
          })(
            this.component,
            this.mentor,
          )}/${this.modal ? this.modal : ''}?embed=true&mode=anonymous&extra-body-classes=iframed-externally${this.isAdvanced ? '&chat=advanced' : ''}${this.modal ? '&modal=' + this.modal : ''}${((s = this.component), s ? (['analytics-overview', 'analytics-users', 'analytics-topics', 'prompt-gallery', 'explore'].includes(null != s ? s : '') ? `&hide_side_nav=true&hide_header=true&component=${s}` : 'recent-messages' === s ? `&hide_header=true&component=${s}` : `&component=${s}`) : '')}${this.extraParams ? '&' + this.extraParams : ''}`);
      }
      this.isContextAware &&
        ((this.lastUrl = window.location.href),
        setInterval(() => {
          this.isContextAware && this.sendHostInfoToIframe();
        }, 1e3)),
        this.documentFilter && this.sendDocumentFilterToIframe(),
        'contextOrigins' === t &&
          (this.contextOrigins = (null == n ? void 0 : n.split(',')) || []),
        'theme' === t && this.switchTheme(n);
    }
    renderContextSettingsView() {
      if (!this.shadowRoot) return;
      const t = this.contextEnabled;
      this.shadowRoot.innerHTML = `\n    <style>\n        :host {\n            display: block;\n            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif;\n        }\n\n        .context-settings-container {\n            padding: 24px;\n            max-width: 600px;\n            color: #1a1a1a;\n        }\n\n        .context-settings-container h1 {\n            font-size: 1.875rem;\n            font-weight: 700;\n            color: #111827;\n            margin: 0 0 24px 0;\n            line-height: 1.2;\n        }\n\n        .checkbox-group {\n            display: flex;\n            align-items: center;\n            gap: 8px;\n            margin-bottom: 20px;\n        }\n\n        .checkbox-input {\n            -webkit-appearance: none;\n            appearance: none;\n            width: 16px;\n            height: 16px;\n            border: 1px solid #1a1a1a;\n            border-radius: 3px;\n            cursor: pointer;\n            position: relative;\n            flex-shrink: 0;\n            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);\n            transition: background-color 0.15s, border-color 0.15s;\n            margin: 0;\n            background-color: white;\n        }\n\n        .checkbox-input:checked {\n            background-color: #3B82F6;\n            border-color: #3B82F6;\n        }\n\n        .checkbox-input:checked::after {\n            content: '';\n            position: absolute;\n            left: 5px;\n            top: 1px;\n            width: 4px;\n            height: 8px;\n            border: solid white;\n            border-width: 0 2px 2px 0;\n            transform: rotate(45deg);\n        }\n\n        .checkbox-input:focus-visible {\n            outline: none;\n            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);\n        }\n\n        .checkbox-label {\n            font-size: 14px;\n            font-weight: 500;\n            color: #1a1a1a;\n            cursor: pointer;\n            user-select: none;\n        }\n\n        .form-group {\n            margin-bottom: 20px;\n        }\n\n        .form-label {\n            display: block;\n            font-size: 14px;\n            font-weight: 500;\n            color: #646464;\n            margin-bottom: 8px;\n            line-height: 1;\n        }\n\n        .form-input {\n            display: flex;\n            width: 100%;\n            height: 36px;\n            padding: 4px 12px;\n            border: 1px solid #e8e8e8;\n            border-radius: 6px;\n            font-size: 14px;\n            font-family: inherit;\n            background: transparent;\n            color: #1a1a1a;\n            box-sizing: border-box;\n            transition: border-color 0.15s, box-shadow 0.15s;\n            outline: none;\n        }\n\n        .form-input:focus {\n            border-color: #b4b4b4;\n            box-shadow: 0 0 0 1px #b4b4b4;\n        }\n\n        .form-input::placeholder {\n            color: #8f8f8f;\n        }\n\n        .form-input:disabled {\n            cursor: not-allowed;\n            opacity: 0.5;\n        }\n\n        .save-button {\n            display: inline-flex;\n            align-items: center;\n            justify-content: center;\n            height: 36px;\n            padding: 8px 16px;\n            background: linear-gradient(to right, #2563EB, #93C5FD);\n            color: white;\n            border: none;\n            border-radius: 6px;\n            font-size: 14px;\n            font-weight: 500;\n            font-family: inherit;\n            cursor: pointer;\n            transition: opacity 0.2s;\n            white-space: nowrap;\n            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);\n        }\n\n        .save-button:hover {\n            opacity: 0.9;\n        }\n\n        .save-button:disabled {\n            opacity: 0.5;\n            pointer-events: none;\n        }\n\n        .settings-message {\n            margin-top: 16px;\n            padding: 12px 16px;\n            border-radius: 6px;\n            font-size: 14px;\n            font-weight: 400;\n        }\n\n        .settings-message.success {\n            background-color: #dcfce7;\n            color: #166534;\n        }\n\n        .settings-message.error {\n            background-color: #fef2f2;\n            color: #991b1b;\n        }\n    </style>\n    <div class="context-settings-container">\n        <h1 id="settings-heading"></h1>\n        <div class="checkbox-group">\n            <input type="checkbox" class="checkbox-input" id="context-enabled" ${t ? 'checked' : ''} />\n            <label class="checkbox-label" for="context-enabled">Enabled</label>\n        </div>\n        <div class="form-group">\n            <label class="form-label" for="mentor-id-input">Mentor ID</label>\n            <input type="text" id="mentor-id-input" class="form-input" placeholder="Enter mentor UUID" />\n        </div>\n        <button id="save-settings-btn" class="save-button">Save</button>\n        <div id="settings-message" class="settings-message" style="display: none;"></div>\n    </div>\n    `;
      const e = this.shadowRoot.querySelector('#settings-heading');
      e && (e.textContent = `Editing LMS Context Id: ${this.contextId || ''}`);
      const n = this.shadowRoot.querySelector('#mentor-id-input');
      n && (n.value = this.mentor || '');
      const o = this.shadowRoot.querySelector('#save-settings-btn');
      o && o.addEventListener('click', () => this.saveContextSettings());
    }
    async saveContextSettings() {
      var t, e, n, o;
      const s =
          null === (t = this.shadowRoot) || void 0 === t
            ? void 0
            : t.querySelector('#context-enabled'),
        i =
          null === (e = this.shadowRoot) || void 0 === e
            ? void 0
            : e.querySelector('#mentor-id-input'),
        a =
          null === (n = this.shadowRoot) || void 0 === n
            ? void 0
            : n.querySelector('#save-settings-btn'),
        r =
          null === (o = this.shadowRoot) || void 0 === o
            ? void 0
            : o.querySelector('#settings-message');
      if (s && i && a && r) {
        (a.disabled = !0),
          (a.textContent = 'Saving...'),
          (r.style.display = 'none');
        try {
          const t = await fetch(
            `${this.lmsUrl}/api/mentor-xblock/orgs/${this.tenant}/context/?context_id=${encodeURIComponent(this.contextId || '')}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ enabled: s.checked, mentor_id: i.value }),
            },
          );
          if (t.ok)
            (r.textContent = 'Settings saved successfully'),
              (r.className = 'settings-message success'),
              (r.style.display = 'block');
          else {
            try {
              const e = await t.json();
              e.error
                ? (r.textContent = e.error)
                : (r.textContent = 'An unknown error occurred');
            } catch (t) {
              r.textContent = 'An unknown error occurred';
            }
            (r.className = 'settings-message error'),
              (r.style.display = 'block');
          }
        } catch (t) {
          (r.textContent = 'An unknown error occurred'),
            (r.className = 'settings-message error'),
            (r.style.display = 'block');
        } finally {
          (a.disabled = !1), (a.textContent = 'Save');
        }
      }
    }
    getCleanBodyContent() {
      const t = document.body.cloneNode(!0);
      e(t.outerHTML);
      const n = (t) => {
        for (let e = 0; e < t.childNodes.length; e++) {
          const o = t.childNodes[e];
          8 === o.nodeType ? (t.removeChild(o), e--) : 1 === o.nodeType && n(o);
        }
      };
      n(t);
      const o = Object.values(this.iframeContexts).map((t) => e(t));
      return t.innerHTML + o.join('');
    }
    sendHostInfoToIframe() {
      var t;
      const e =
        null === (t = this.shadowRoot) || void 0 === t
          ? void 0
          : t.querySelector('#ibl-chat-widget-container iframe');
      if (e && e.contentWindow) {
        const t = this.getCleanBodyContent(),
          n = {
            type: 'MENTOR:CONTEXT_UPDATE',
            hostInfo: { title: document.title, href: window.location.href },
            pageContent: t,
          };
        e.contentWindow.postMessage(n, '*');
      }
      this.sendHostInfoToPopup();
    }
    getPopupWindow() {
      if (this.popupWindow && !this.popupWindow.closed) return this.popupWindow;
      const t = localStorage.getItem(a);
      if (t) {
        const e = window.open('', t);
        if (e && !e.closed && 'about:blank' !== e.location.href)
          return (this.popupWindow = e), e;
        e && 'about:blank' === e.location.href && e.close(),
          localStorage.removeItem(a),
          (this.popupWindow = null);
      }
      return null;
    }
    sendHostInfoToPopup() {
      const t = this.getPopupWindow();
      if (t) {
        const e = this.getCleanBodyContent(),
          n = {
            type: 'MENTOR:CONTEXT_UPDATE',
            hostInfo: { title: document.title, href: window.location.href },
            pageContent: e,
          };
        t.postMessage(n, '*');
      }
    }
    isInIframe() {
      try {
        return window.self !== window.top;
      } catch (t) {
        return !0;
      }
    }
    showRefreshInstruction() {
      var t, e, n;
      const o =
          null === (t = this.shadowRoot) || void 0 === t
            ? void 0
            : t.querySelector('#refresh-instruction'),
        s =
          null === (e = this.shadowRoot) || void 0 === e
            ? void 0
            : e.querySelector('iframe'),
        i =
          null === (n = this.shadowRoot) || void 0 === n
            ? void 0
            : n.querySelector('#loading-spinner');
      o &&
        ((o.innerHTML =
          '\n        <p>Your session has expired. Please refresh the page to continue.</p>\n      '),
        (o.style.display = 'block')),
        s && (s.style.display = 'none'),
        i && (i.style.display = 'none');
    }
    showScreenSharingOverlay() {
      var t;
      const e =
        null === (t = this.shadowRoot) || void 0 === t
          ? void 0
          : t.querySelector('#screensharing-overlay');
      e &&
        (e.classList.add('active'),
        (this.sentOpenNewWindowForScreenShare = !0));
    }
    hideScreenSharingOverlay() {
      var t;
      const e =
        null === (t = this.shadowRoot) || void 0 === t
          ? void 0
          : t.querySelector('#screensharing-overlay');
      e && e.classList.remove('active'), this.resetAudioStatus();
    }
    resetAudioStatus() {
      (this.isMicMuted = !1),
        (this.isMicSpeaking = !1),
        (this.isMentorMuted = !1),
        (this.isMentorSpeaking = !1),
        this.updateAudioStatusUI();
    }
    updateMicMutedState(t) {
      (this.isMicMuted = t),
        t && (this.isMicSpeaking = !1),
        this.updateAudioStatusUI();
    }
    updateMicSpeakingState(t) {
      this.isMicMuted || ((this.isMicSpeaking = t), this.updateAudioStatusUI());
    }
    updateMentorMutedState(t) {
      (this.isMentorMuted = t),
        t && (this.isMentorSpeaking = !1),
        this.updateAudioStatusUI();
    }
    updateMentorSpeakingState(t) {
      this.isMentorMuted ||
        ((this.isMentorSpeaking = t), this.updateAudioStatusUI());
    }
    updateAudioStatusUI() {
      var t, e, n, o, s, i, a, r, d, l;
      const c =
          null === (t = this.shadowRoot) || void 0 === t
            ? void 0
            : t.querySelector('#mentor-status-dot'),
        h =
          null === (e = this.shadowRoot) || void 0 === e
            ? void 0
            : e.querySelector('#mentor-status-text'),
        u =
          null === (n = this.shadowRoot) || void 0 === n
            ? void 0
            : n.querySelector('#mentor-audio-btn'),
        p =
          null === (o = this.shadowRoot) || void 0 === o
            ? void 0
            : o.querySelector('#mentor-icon-on'),
        g =
          null === (s = this.shadowRoot) || void 0 === s
            ? void 0
            : s.querySelector('#mentor-icon-muted'),
        m =
          null === (i = this.shadowRoot) || void 0 === i
            ? void 0
            : i.querySelector('#mic-status-dot'),
        b =
          null === (a = this.shadowRoot) || void 0 === a
            ? void 0
            : a.querySelector('#mic-status-text'),
        x =
          null === (r = this.shadowRoot) || void 0 === r
            ? void 0
            : r.querySelector('#mic-audio-btn'),
        w =
          null === (d = this.shadowRoot) || void 0 === d
            ? void 0
            : d.querySelector('#mic-icon-on'),
        v =
          null === (l = this.shadowRoot) || void 0 === l
            ? void 0
            : l.querySelector('#mic-icon-muted');
      c &&
        h &&
        u &&
        (c.classList.remove('muted', 'speaking'),
        h.classList.remove('speaking'),
        u.classList.remove('muted'),
        this.isMentorMuted
          ? (c.classList.add('muted'),
            u.classList.add('muted'),
            (h.textContent = 'Mentor muted'),
            p && (p.style.display = 'none'),
            g && (g.style.display = 'block'))
          : this.isMentorSpeaking
            ? (c.classList.add('speaking'),
              h.classList.add('speaking'),
              (h.textContent = 'Mentor speaking'),
              p && (p.style.display = 'block'),
              g && (g.style.display = 'none'))
            : ((h.textContent = 'Mentor audio on'),
              p && (p.style.display = 'block'),
              g && (g.style.display = 'none'))),
        m &&
          b &&
          x &&
          (m.classList.remove('muted', 'speaking'),
          b.classList.remove('speaking'),
          x.classList.remove('muted'),
          this.isMicMuted
            ? (m.classList.add('muted'),
              x.classList.add('muted'),
              (b.textContent = 'Muted'),
              w && (w.style.display = 'none'),
              v && (v.style.display = 'block'))
            : this.isMicSpeaking
              ? (m.classList.add('speaking'),
                b.classList.add('speaking'),
                (b.textContent = 'Speaking'),
                w && (w.style.display = 'block'),
                v && (v.style.display = 'none'))
              : ((b.textContent = 'Mic on'),
                w && (w.style.display = 'block'),
                v && (v.style.display = 'none')));
    }
    stopScreenSharing() {
      this.isInIframe() &&
        window.parent.postMessage(
          { type: 'MENTOR:SCREENSHARING_STOPPED' },
          '*',
        );
      const t = this.getPopupWindow();
      t && !t.closed && t.close(),
        localStorage.removeItem(a),
        (this.popupWindow = null),
        this.sendDataToIframe({ type: 'MENTOR:SCREENSHARING_STOPPED' }),
        this.hideScreenSharingOverlay(),
        (this.sentOpenNewWindowForScreenShare = !1),
        localStorage.removeItem(r);
    }
    toggleMute() {
      this.updateMicMutedState(!this.isMicMuted);
      const t = { type: 'MENTOR:SCREENSHARING_MUTED' };
      if (this.isInIframe()) window.parent.postMessage(t, '*');
      else {
        const e = this.getPopupWindow();
        e && !e.closed && e.postMessage(t, '*');
      }
    }
    toggleMentorMute() {
      this.updateMentorMutedState(!this.isMentorMuted);
      const t = { type: 'MENTOR:SCREENSHARING_MENTOR_MUTED' };
      if (this.isInIframe()) window.parent.postMessage(t, '*');
      else {
        const e = this.getPopupWindow();
        e && !e.closed && e.postMessage(t, '*');
      }
    }
    getEdxJwtToken() {
      if (this.iblData)
        try {
          return JSON.parse(this.iblData).edx_jwt_token;
        } catch (t) {
          return void console.error('Error parsing iblData: ', t);
        }
    }
    sendDocumentFilterToIframe() {
      this.sendDataToIframe({
        type: 'MENTOR:DOCUMENTFILTER',
        data: this.documentFilter,
      });
    }
    sendDataToIframe(t) {
      var e;
      const n =
        null === (e = this.shadowRoot) || void 0 === e
          ? void 0
          : e.querySelector('#ibl-chat-widget-container iframe');
      n && n.contentWindow && n.contentWindow.postMessage(t, '*');
    }
    switchTheme(t) {
      var e;
      const n =
        null === (e = this.shadowRoot) || void 0 === e
          ? void 0
          : e.querySelector('#ibl-chat-widget-container iframe');
      n &&
        n.contentWindow &&
        n.contentWindow.postMessage(JSON.stringify({ theme: t }), '*');
    }
    sendAuthDataToIframe(t) {
      var e;
      const n =
        null === (e = this.shadowRoot) || void 0 === e
          ? void 0
          : e.querySelector('#ibl-chat-widget-container iframe');
      n && n.contentWindow && n.contentWindow.postMessage(t, '*');
    }
    isTokenExpired(t) {
      const e = new Date(t);
      return new Date() >= e;
    }
    redirectToAuthSPA(t) {
      var e;
      if (this.authRelyOnHost) {
        const t =
          null === (e = this.shadowRoot) || void 0 === e
            ? void 0
            : e.querySelector('#ibl-chat-widget-container iframe');
        return void (
          t &&
          t.contentWindow &&
          t.contentWindow.postMessage({ ...localStorage }, '*')
        );
      }
      const n = window.location.pathname + window.location.search;
      window.location.href = `${this.authUrl}/login?redirect-path=${n}&tenant=${this.tenant}${t ? '&logout=true' : ''}&redirect-token=${this.redirectToken}`;
    }
    toggleWidget() {
      const t = document.getElementById('ibl-chat-widget-container');
      t &&
        ('none' === t.style.display
          ? (t.style.display = '')
          : (t.style.display = 'none'));
    }
  }
  class l extends d {}
  'undefined' != typeof window &&
    (customElements.get('mentor-ai') || customElements.define('mentor-ai', d),
    customElements.get('agent-ai') || customElements.define('agent-ai', l)),
    (t.default = d),
    (t.proxyContextPostMessage = function (t, e) {
      window.addEventListener('message', (n) => {
        if ('context' === n.data.type)
          if (window.self !== window.top) window.parent.postMessage(n.data, t);
          else {
            const o = document.getElementById(t);
            if (o && o.contentWindow) {
              const t = e || '*';
              o.contentWindow.postMessage(n.data, t);
            } else
              console.log(
                'Iframe not found or contentWindow is not accessible.',
              );
          }
      });
    }),
    (t.sendHTMLContentToHost = function (t, e = 5e3) {
      const n = new Worker(o);
      (n.onmessage = (e) => {
        const n = e.data;
        window.parent.postMessage({ type: 'context', data: n }, t);
      }),
        setInterval(() => {
          if (window.self !== window.top) {
            const t = document.documentElement.outerHTML;
            n.postMessage(t);
          }
        }, e);
    }),
    (t.sendHTMLContentToIframe = function (t, e, n = 5e3) {
      let s;
      const i = new Worker(o);
      let a = document.documentElement.outerHTML;
      (i.onmessage = (t) => {
        var e;
        const n = t.data;
        null === (e = null == s ? void 0 : s.contentWindow) ||
          void 0 === e ||
          e.postMessage({ type: 'context', data: n }, '*');
      }),
        setInterval(() => {
          (s = t instanceof HTMLIFrameElement ? t : document.getElementById(t)),
            (a = document.documentElement.outerHTML),
            s && s.contentWindow
              ? i.postMessage(a)
              : console.log(
                  'Iframe not found or contentWindow is not accessible.',
                );
        }, n);
    }),
    Object.defineProperty(t, '__esModule', { value: !0 });
});
//# sourceMappingURL=index.umd.js.map
