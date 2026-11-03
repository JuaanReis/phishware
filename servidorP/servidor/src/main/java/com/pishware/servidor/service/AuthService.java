package com.pishware.servidor.service;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;


@Service
public class AuthService {

    private final RestClient restClient;
    private final String baseUrl;

    public AuthService(
            RestClient.Builder builder,
            @Value("${scamlens.api.base-url}") String baseUrl) {

        this.baseUrl = baseUrl.endsWith("/")
                ? baseUrl.substring(0, baseUrl.length() - 1)
                : baseUrl;
        this.restClient = builder.baseUrl(this.baseUrl).build();
    }

    private ResponseEntity<byte[]> enviar(
            HttpMethod metodo,
            String rota,
            Object corpo,
            HttpServletRequest requisicao,
            MediaType tipoConteudo) {

        var chamada = restClient.method(metodo).uri(rota);

        chamada.headers(headers -> {
            copiarCredenciais(requisicao, headers);

            if (tipoConteudo != null &&
                    !MediaType.MULTIPART_FORM_DATA.isCompatibleWith(tipoConteudo)) {
                headers.setContentType(tipoConteudo);
            }

            headers.setAccept(List.of(MediaType.APPLICATION_JSON, MediaType.ALL));
        });

        if (corpo != null) {
            chamada.body(corpo);
        }

        final boolean https = ehHttps(requisicao);

        try {
            return chamada.exchange((request, response) -> {
                HttpHeaders headersResposta = new HttpHeaders();

                copiarHeader(response.getHeaders(), headersResposta, HttpHeaders.CONTENT_TYPE);
                copiarHeader(response.getHeaders(), headersResposta, HttpHeaders.RETRY_AFTER);

                List<String> cookies = response.getHeaders().get(HttpHeaders.SET_COOKIE);
                if (cookies != null) {
                    for (String cookie : cookies) {
                        headersResposta.add(
                                HttpHeaders.SET_COOKIE,
                                ajustarCookie(cookie, requisicao != null, https));
                    }
                }

                byte[] resposta = response.getBody().readAllBytes();

                return new ResponseEntity<>(
                        resposta,
                        headersResposta,
                        response.getStatusCode());
            });
        } catch (RuntimeException erro) {
            return erroGateway("A API de analise nao respondeu: " + erro.getMessage());
        }
    }

    private void copiarCredenciais(HttpServletRequest requisicao, HttpHeaders headers) {
        if (requisicao == null) {
            return;
        }

        String cookie = requisicao.getHeader(HttpHeaders.COOKIE);
        String authorization = requisicao.getHeader(HttpHeaders.AUTHORIZATION);

        if (cookie != null && !cookie.isBlank()) {
            headers.set(HttpHeaders.COOKIE, cookie);
        }
        if (authorization != null && !authorization.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, authorization);
        }

        String ip = requisicao.getRemoteAddr();
        if (ip != null && !ip.isBlank()) {
            headers.set("X-Forwarded-For", ip);
        }
    }

    private boolean ehHttps(HttpServletRequest requisicao) {
        if (requisicao == null) {
            return false;
        }
        String proto = requisicao.getHeader("X-Forwarded-Proto");
        return requisicao.isSecure() || "https".equalsIgnoreCase(proto);
    }
    private String ajustarCookie(String cookie, boolean reescrever, boolean https) {
        if (!reescrever) {
            return cookie;
        }

        StringBuilder resultado = new StringBuilder();

        for (String parte : cookie.split(";")) {
            String atributo = parte.trim();
            if (atributo.isEmpty()) {
                continue;
            }

            String minusculo = atributo.toLowerCase(Locale.ROOT);

            if (minusculo.startsWith("domain=")) {
                continue;
            }
            if (!https && minusculo.equals("secure")) {
                continue;
            }
            if (!https && minusculo.equals("samesite=none")) {
                atributo = "SameSite=Lax";
            }

            if (resultado.length() > 0) {
                resultado.append("; ");
            }
            resultado.append(atributo);
        }

        return resultado.toString();
    }

    private void copiarHeader(HttpHeaders origem, HttpHeaders destino, String nome) {
        List<String> valores = origem.get(nome);
        if (valores != null) {
            destino.put(nome, new ArrayList<>(valores));
        }
    }

    private ResponseEntity<byte[]> erroGateway(String mensagem) {
        String json = "{\"detail\":\"" + mensagem.replace("\\", "\\\\").replace("\"", "'") + "\"}";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return new ResponseEntity<>(
                json.getBytes(StandardCharsets.UTF_8),
                headers,
                HttpStatus.BAD_GATEWAY);
    }

    private MultiValueMap<String, Object> parteArquivo(
            MultipartFile arquivo,
            String nomePadrao) throws IOException {

        String nome = arquivo.getOriginalFilename();
        String filename = (nome == null || nome.isBlank()) ? nomePadrao : nome;

        ByteArrayResource resource = new ByteArrayResource(arquivo.getBytes()) {
            @Override
            public String getFilename() {
                return filename;
            }
        };

        MultiValueMap<String, Object> partes = new LinkedMultiValueMap<>();
        partes.add("file", resource);
        return partes;
    }

    private String segmento(String id) {
        return UriUtils.encodePathSegment(id, StandardCharsets.UTF_8);
    }

    public ResponseEntity<byte[]> cadastrar(Map<String, Object> dados, HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/auth/register", dados, request, MediaType.APPLICATION_JSON);
    }

    public ResponseEntity<byte[]> login(Map<String, Object> dados, HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/auth/login", dados, request, MediaType.APPLICATION_JSON);
    }

    public ResponseEntity<byte[]> refresh(HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/auth/refresh", null, request, null);
    }

    public ResponseEntity<byte[]> logout(HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/auth/logout", null, request, null);
    }

    public ResponseEntity<byte[]> verificarSessao(HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/user/me", null, request, null);
    }

    public ResponseEntity<byte[]> perfil(HttpServletRequest request) {
        return verificarSessao(request);
    }

    /* -------------------------------- Analises -------------------------------- */

    public ResponseEntity<byte[]> analisarUrl(Map<String, Object> dados, HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/scurl/analyze/url", dados, request, MediaType.APPLICATION_JSON);
    }

    public ResponseEntity<byte[]> analisarQrCode(MultipartFile arquivo, HttpServletRequest request) throws IOException {
        return enviar(HttpMethod.POST, "/api/scurl/qr/analyze/qr",
                parteArquivo(arquivo, "qrcode.png"), request, MediaType.MULTIPART_FORM_DATA);
    }

    public ResponseEntity<byte[]> analisarArquivo(MultipartFile arquivo, HttpServletRequest request) throws IOException {
        return enviar(HttpMethod.POST, "/api/scfs/analyze/file",
                parteArquivo(arquivo, "arquivo"), request, MediaType.MULTIPART_FORM_DATA);
    }

    public ResponseEntity<byte[]> analisarImagem(MultipartFile arquivo, HttpServletRequest request) throws IOException {
        return enviar(HttpMethod.POST, "/api/scimg/analyze/image",
                parteArquivo(arquivo, "image"), request, MediaType.MULTIPART_FORM_DATA);
    }

    public ResponseEntity<byte[]> analisarPix(Map<String, Object> dados, HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/scpix/analyze/pix", dados, request, MediaType.APPLICATION_JSON);
    }

    public ResponseEntity<byte[]> historicoUsuario(String module, HttpServletRequest request) {
        String rota = "/api/user/scans";
        if (module != null && !module.isBlank()) {
            rota += "?module=" + UriUtils.encodeQueryParam(module, StandardCharsets.UTF_8);
        }
        return enviar(HttpMethod.GET, rota, null, request, null);
    }

    public ResponseEntity<byte[]> historicoUrl(int limit, int offset, HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scurl/scans?limit=" + limit + "&offset=" + offset,
                null, request, null);
    }

    public ResponseEntity<byte[]> buscarAnaliseUrl(String id, HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scurl/scans/" + segmento(id), null, request, null);
    }

    public ResponseEntity<byte[]> historicoArquivos(HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scfs/scans", null, request, null);
    }

    public ResponseEntity<byte[]> buscarAnaliseArquivo(String id, HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scfs/scans/" + segmento(id), null, request, null);
    }

    public ResponseEntity<byte[]> historicoPix(HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scpix/scans", null, request, null);
    }

    public ResponseEntity<byte[]> buscarAnalisePix(String id, HttpServletRequest request) {
        return enviar(HttpMethod.GET, "/api/scpix/scans/" + segmento(id), null, request, null);
    }

    public ResponseEntity<byte[]> enviarAvatar(MultipartFile arquivo, HttpServletRequest request) throws IOException {
        return enviar(HttpMethod.POST, "/api/user/avatar",
                parteArquivo(arquivo, "avatar.png"), request, MediaType.MULTIPART_FORM_DATA);
    }

    public ResponseEntity<byte[]> mensagensChat(String query, HttpServletRequest request) {
        String rota = "/api/chat/messages";
        if (query != null && !query.isBlank()) {
            rota += "?" + query;
        }
        return enviar(HttpMethod.GET, rota, null, request, null);
    }

    public ResponseEntity<byte[]> enviarMensagemChat(Map<String, Object> dados, HttpServletRequest request) {
        return enviar(HttpMethod.POST, "/api/chat/messages", dados, request, MediaType.APPLICATION_JSON);
    }

    public ResponseEntity<byte[]> health() {
        return enviar(HttpMethod.GET, "/health", null, null, null);
    }
    public ResponseEntity<byte[]> buscarMidia(String caminho, HttpServletRequest requisicao) {
        if (caminho == null) {
            return ResponseEntity.badRequest().build();
        }

        String limpo = caminho.trim().replace(" ", "%20");

        if (!caminhoMidiaValido(limpo)) {
            return ResponseEntity.badRequest().build();
        }

        try {
            URI uri = URI.create(baseUrl + limpo);

            return restClient.get()
                    .uri(uri)
                    .headers(headers -> {
                        copiarCredenciais(requisicao, headers);
                        headers.setAccept(List.of(MediaType.parseMediaType("image/*")));
                    })
                    .exchange((request, response) -> {
                        MediaType tipo = response.getHeaders().getContentType();

                        if (!response.getStatusCode().is2xxSuccessful()
                                || tipo == null
                                || !"image".equalsIgnoreCase(tipo.getType())) {
                            return ResponseEntity.status(HttpStatus.NOT_FOUND).<byte[]>build();
                        }

                        byte[] corpo = response.getBody().readAllBytes();

                        HttpHeaders headers = new HttpHeaders();
                        headers.setContentType(tipo);
                        headers.setCacheControl(CacheControl.noCache().cachePrivate());

                        return new ResponseEntity<>(corpo, headers, HttpStatus.OK);
                    });

        } catch (RuntimeException erro) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).build();
        }
    }

    private boolean caminhoMidiaValido(String caminho) {
        if (caminho.length() > 512
                || !caminho.startsWith("/")
                || caminho.startsWith("//")
                || caminho.contains("..")
                || caminho.contains("\\")
                || caminho.contains("://")) {
            return false;
        }
        return caminho.chars().noneMatch(c -> c < 0x20 || c == 0x7f);
    }
}
