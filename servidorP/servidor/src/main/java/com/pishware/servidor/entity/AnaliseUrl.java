package com.pishware.servidor.entity;

public class AnaliseUrl {
    private String url;
    private boolean use_cache;

    public AnaliseUrl(String url) {
        this.url = url;
        this.use_cache = false;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public boolean isUse_cache() {
        return use_cache;
    }

    public void setUse_cache(boolean use_cache) {
        this.use_cache = use_cache;
    }
}
