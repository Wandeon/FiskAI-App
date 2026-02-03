/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from "next-auth"
import { authConfig } from "./config"

const nextAuth = NextAuth(authConfig)

export const handlers: any = nextAuth.handlers
export const auth: any = nextAuth.auth
export const signIn: any = nextAuth.signIn
export const signOut: any = nextAuth.signOut
