package com.pishware.servidor.controller;

import com.pishware.servidor.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
public class Controller1 {

    private final AuthService authService;

    public Controller1(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/cadastrar")
    public ResponseEntity<byte[]> cadastrar(
            @RequestBody Map<String, Object> dados,
            HttpServletRequest request) {
        return authService.cadastrar(dados, request);
    }

    @PostMapping("/login")
    public ResponseEntity<byte[]> login(
            @RequestBody Map<String, Object> dados,
            HttpServletRequest request) {
        return authService.login(dados, request);
    }

    @PostMapping("/refresh")
    public ResponseEntity<byte[]> refresh(HttpServletRequest request) {
        return authService.refresh(request);
    }

    @PostMapping("/logout")
    public ResponseEntity<byte[]> logout(HttpServletRequest request) {
        return authService.logout(request);
    }

    @GetMapping("/verificar-sessao")
    public ResponseEntity<byte[]> verificarSessao(HttpServletRequest request) {
        return authService.verificarSessao(request);
    }

    @GetMapping("/perfil")
    public ResponseEntity<byte[]> perfil(HttpServletRequest request) {
        return authService.perfil(request);
    }

    @PostMapping("/AnaliseUrl")
    public ResponseEntity<byte[]> analisarUrl(
            @RequestBody Map<String, Object> dados,
            HttpServletRequest request) {
        return authService.analisarUrl(dados, request);
    }

    @PostMapping("/AnaliseQrCode")
    public ResponseEntity<byte[]> analisarQrCode(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return authService.analisarQrCode(file, request);
    }

    @PostMapping("/AnaliseArquivo")
    public ResponseEntity<byte[]> analisarArquivo(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return authService.analisarArquivo(file, request);
    }

    @PostMapping("/AnaliseImagem")
    public ResponseEntity<byte[]> analisarImagem(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return authService.analisarImagem(file, request);
    }

    @PostMapping("/AnalisePix")
    public ResponseEntity<byte[]> analisarPix(
            @RequestBody Map<String, Object> dados,
            HttpServletRequest request) {
        return authService.analisarPix(dados, request);
    }
    @GetMapping("/historico")
    public ResponseEntity<byte[]> historicoUsuario(
            @RequestParam(required = false) String module,
            HttpServletRequest request) {
        return authService.historicoUsuario(module, request);
    }
    @GetMapping("/historico/url")
    public ResponseEntity<byte[]> historicoUrl(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset,
            HttpServletRequest request) {
        return authService.historicoUrl(limit, offset, request);
    }
    @GetMapping("/historico/url/{id}")
    public ResponseEntity<byte[]> buscarAnaliseUrl(
            @PathVariable String id,
            HttpServletRequest request) {
        return authService.buscarAnaliseUrl(id, request);
    }
    @GetMapping("/historico/arquivos")
    public ResponseEntity<byte[]> historicoArquivos(HttpServletRequest request) {
        return authService.historicoArquivos(request);
    }
    @GetMapping("/historico/arquivos/{id}")
    public ResponseEntity<byte[]> buscarAnaliseArquivo(
            @PathVariable String id,
            HttpServletRequest request) {
        return authService.buscarAnaliseArquivo(id, request);
    }
    @GetMapping("/historico/pix")
    public ResponseEntity<byte[]> historicoPix(HttpServletRequest request) {
        return authService.historicoPix(request);
    }

    @GetMapping("/historico/pix/{id}")
    public ResponseEntity<byte[]> buscarAnalisePix(
            @PathVariable String id,
            HttpServletRequest request) {
        return authService.buscarAnalisePix(id, request);
    }
    @PostMapping("/avatar")
    public ResponseEntity<byte[]> enviarAvatar(
            @RequestParam("file") MultipartFile file,
            HttpServletRequest request) throws IOException {
        return authService.enviarAvatar(file, request);
    }
    @GetMapping("/midia")
    public ResponseEntity<byte[]> midia(
            @RequestParam("path") String path,
            HttpServletRequest request) {
        return authService.buscarMidia(path, request);
    }

    @GetMapping("/chat/mensagens")
    public ResponseEntity<byte[]> mensagensChat(HttpServletRequest request) {
        return authService.mensagensChat(request.getQueryString(), request);
    }

    @PostMapping("/chat/mensagens")
    public ResponseEntity<byte[]> enviarMensagemChat(
            @RequestBody Map<String, Object> dados,
            HttpServletRequest request) {
        return authService.enviarMensagemChat(dados, request);
    }
    @GetMapping("/health")
    public ResponseEntity<byte[]> health() {
        return authService.health();
    }
}
