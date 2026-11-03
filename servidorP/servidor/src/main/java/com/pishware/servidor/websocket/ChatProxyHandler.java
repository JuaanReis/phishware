package com.pishware.servidor.websocket;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.net.http.WebSocketHandshakeException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;


@Component
public class ChatProxyHandler extends TextWebSocketHandler {

    private static final int POLICY_VIOLATION = 1008;

    private final String urlApi;
    private final String origemApi;
    private final HttpClient cliente = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(20))
            .build();

    private final Map<String, WebSocket> conexoes = new ConcurrentHashMap<>();

    public ChatProxyHandler(@Value("${scamlens.api.base-url}") String baseUrl) {
        String base = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;

        this.origemApi = base;
        this.urlApi = base.replaceFirst("^http", "ws") + "/api/chat/ws";
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession sessao) {
        WebSocket.Builder construtor = cliente.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .header("Origin", origemApi);

        HttpHeaders headers = sessao.getHandshakeHeaders();

        String cookie = headers.getFirst(HttpHeaders.COOKIE);
        if (cookie != null && !cookie.isBlank()) {
            construtor.header("Cookie", cookie);
        }

        String authorization = headers.getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization != null && !authorization.isBlank()) {
            construtor.header("Authorization", authorization);
        }

        construtor.buildAsync(URI.create(urlApi), new Ponte(sessao))
                .whenComplete((ws, erro) -> {
                    if (erro != null) {
                        fechar(sessao, statusDoErro(erro));
                        return;
                    }

                    if (!sessao.isOpen()) {
                        ws.abort();
                        return;
                    }

                    conexoes.put(sessao.getId(), ws);
                });
    }

    @Override
    protected void handleTextMessage(WebSocketSession sessao, TextMessage mensagem) {
        WebSocket ws = conexoes.get(sessao.getId());

        if (ws != null) {
            ws.sendText(mensagem.getPayload(), true);
        }
    }

    @Override
    public void handleTransportError(WebSocketSession sessao, Throwable erro) {
        encerrarApi(sessao);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession sessao, CloseStatus status) {
        encerrarApi(sessao);
    }

    private void encerrarApi(WebSocketSession sessao) {
        WebSocket ws = conexoes.remove(sessao.getId());

        if (ws != null && !ws.isOutputClosed()) {
            ws.sendClose(WebSocket.NORMAL_CLOSURE, "");
        }
    }

    private CloseStatus statusDoErro(Throwable erro) {
        Throwable causa = erro instanceof CompletionException && erro.getCause() != null
                ? erro.getCause()
                : erro;

        if (causa instanceof WebSocketHandshakeException) {
            int codigo = ((WebSocketHandshakeException) causa).getResponse().statusCode();

            if (codigo == 401 || codigo == 403) {
                return new CloseStatus(POLICY_VIOLATION, "Sessao recusada");
            }
        }

        return CloseStatus.SERVER_ERROR;
    }

    private void fechar(WebSocketSession sessao, CloseStatus status) {
        try {
            synchronized (sessao) {
                if (sessao.isOpen()) {
                    sessao.close(status);
                }
            }
        } catch (IOException ignorado) {
            // Navegador ja desconectou.
        }
    }

    private class Ponte implements WebSocket.Listener {

        private final WebSocketSession sessao;
        private final StringBuilder acumulado = new StringBuilder();

        Ponte(WebSocketSession sessao) {
            this.sessao = sessao;
        }

        @Override
        public void onOpen(WebSocket ws) {
            ws.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket ws, CharSequence dados, boolean ultima) {
            acumulado.append(dados);

            if (ultima) {
                String texto = acumulado.toString();
                acumulado.setLength(0);

                try {
                    synchronized (sessao) {
                        if (sessao.isOpen()) {
                            sessao.sendMessage(new TextMessage(texto));
                        }
                    }
                } catch (IOException erro) {
                    fechar(sessao, CloseStatus.SERVER_ERROR);
                }
            }

            ws.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket ws, int codigo, String motivo) {
            boolean permitido = codigo >= 1000 && codigo < 5000
                    && codigo != 1005 && codigo != 1006 && codigo != 1015;

            fechar(sessao, permitido
                    ? new CloseStatus(codigo, motivo)
                    : CloseStatus.NORMAL);

            return null;
        }

        @Override
        public void onError(WebSocket ws, Throwable erro) {
            fechar(sessao, CloseStatus.SERVER_ERROR);
        }
    }
}
