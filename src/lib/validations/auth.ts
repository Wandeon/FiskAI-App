import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Unesite ispravnu email adresu"),
  password: z.string().min(1, "Lozinka je obavezna"),
})

export const registerSchema = z
  .object({
    name: z.string().min(2, "Ime mora imati najmanje 2 znaka"),
    email: z.string().email("Unesite ispravnu email adresu"),
    password: z
      .string()
      .min(8, "Lozinka mora imati najmanje 8 znakova")
      .regex(/[A-Z]/, "Lozinka mora sadržavati barem jedno veliko slovo")
      .regex(/[0-9]/, "Lozinka mora sadržavati barem jedan broj"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lozinke se ne podudaraju",
    path: ["confirmPassword"],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
