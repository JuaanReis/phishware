package com.pishware.servidor.entity;

public class UserRequest {
    private String email;
    private String password;
    private boolean remember;

    public UserRequest(String email, String password) {
        this.email = email;
        this.password = password;
        this.remember = false;
    }

    public boolean isRemember() {
        return remember;
    }

    public void setRemember(boolean remember) {
        this.remember = remember;
    }
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }
}
