import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      companyId: string | null;
      companyName: string | null;
      companySlug: string | null;
    };
  }

  interface User {
    role: string;
    companyId: string | null;
    companyName: string | null;
    companySlug: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    companyId: string | null;
    companyName: string | null;
    companySlug: string | null;
  }
}
