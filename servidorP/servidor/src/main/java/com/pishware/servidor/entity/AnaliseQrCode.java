package com.pishware.servidor.entity;

import org.springframework.web.multipart.MultipartFile;

public class AnaliseQrCode {
    private MultipartFile qrcode;

    public AnaliseQrCode(MultipartFile qrcode) {
        this.qrcode = qrcode;
    }

    public MultipartFile getQrcode() {
        return qrcode;
    }

    public void setQrcode(MultipartFile qrcode) {
        this.qrcode = qrcode;
    }
}
