"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const store_1 = require("../database/store");
const env_1 = require("../config/env");
const auth_1 = require("../middleware/auth");
const uuid_1 = require("uuid");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    const user = store_1.db.users.get(email.toLowerCase());
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = bcryptjs_1.default.compareSync(password, user.passwordHash);
    if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    user.lastLogin = new Date().toISOString();
    const token = jsonwebtoken_1.default.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, env_1.ENV.JWT_SECRET, { expiresIn: '24h' });
    res.json({
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            lastLogin: user.lastLogin
        }
    });
});
exports.authRouter.post('/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password required' });
    }
    if (store_1.db.users.has(email.toLowerCase())) {
        return res.status(409).json({ error: 'User already exists' });
    }
    const allowedRoles = ['admin', 'qa_manager', 'reliability_engineer', 'operator', 'fa_engineer'];
    const userRole = allowedRoles.includes(role) ? role : 'reliability_engineer';
    const salt = bcryptjs_1.default.genSaltSync(10);
    const passwordHash = bcryptjs_1.default.hashSync(password, salt);
    const newUser = {
        id: (0, uuid_1.v4)(),
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: userRole,
        createdAt: new Date().toISOString()
    };
    store_1.db.users.set(newUser.email, newUser);
    const token = jsonwebtoken_1.default.sign({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }, env_1.ENV.JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({
        token,
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            createdAt: newUser.createdAt
        }
    });
});
exports.authRouter.get('/me', auth_1.authenticateToken, (req, res) => {
    res.json({ user: req.user });
});
