package com.pishware.servidor.configuration;

import com.pishware.servidor.websocket.ChatProxyHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatProxyHandler chatProxyHandler;

    public WebSocketConfig(ChatProxyHandler chatProxyHandler) {
        this.chatProxyHandler = chatProxyHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(chatProxyHandler, "/chat/ws");
    }
}
