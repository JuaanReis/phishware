"use strict";


window.PHISHWARE_CONFIG = {
  ENDPOINTS: {
    url: "/AnaliseUrl",
    qr: "/AnaliseQrCode",
    file: "/AnaliseArquivo",
    pix: "/AnalisePix",
    image: "/AnaliseImagem"
  },

  AUTH: {
    login: "/login",
    register: "/cadastrar",
    refresh: "/refresh",
    logout: "/logout",
    me: "/perfil"
  },

  AVATAR: {
    upload: "/avatar",
    media: "/midia"
  },

  CHAT: {
    messages: "/chat/mensagens",
    ws: "/chat/ws",
    HISTORY_LIMIT: 50,
    MAX_LENGTH: 2000
  },

  HISTORY_ENDPOINT: "/historico",
  HEALTH: "/health",

  TIMEOUT_MS: 120000,
  MAX_URL_LENGTH: 2048,
  MAX_PIX_LENGTH: 4096,
  MAX_IMAGE_MB: 10,
  MAX_FILE_MB: 50,
  MAX_AVATAR_MB: 5
};
