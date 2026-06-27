import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { adminPrisma } from "@pms/db";
import { env } from "../lib/env";
import { AppError } from "../utils/AppError";
import type { AdminLoginDto, CreateHotelDto, UpdateHotelDto } from "../schemas/admin";

const jwtOpts = (expiresIn: string): SignOptions => ({ expiresIn: expiresIn as SignOptions["expiresIn"] });

const ADJECTIVES = ["Swift", "Brave", "Royal", "Grand", "Elite", "Peak", "Bold"];
const SYMBOLS = ["@", "#", "!", "$"];

function generateTempPassword(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  return `${adj}${sym}2026`;
}

export const AdminService = {
  login(dto: AdminLoginDto) {
    if (dto.email !== env.ADMIN_EMAIL || dto.password !== env.ADMIN_PASSWORD) {
      throw new AppError(401, "Invalid admin credentials");
    }

    const token = jwt.sign(
      { isSuperAdmin: true, email: dto.email },
      env.ADMIN_JWT_SECRET,
      jwtOpts("24h")
    );

    return { token, admin: { email: dto.email } };
  },

  async listHotels() {
    return adminPrisma.hotel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        city: true,
        isActive: true,
        onboardingCompleted: true,
        createdAt: true,
        _count: {
          select: { rooms: true, reservations: true, users: true },
        },
      },
    });
  },

  async getHotel(id: string) {
    const hotel = await adminPrisma.hotel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rooms: true, reservations: true, users: true },
        },
        users: {
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true, isFirstLogin: true } },
          },
        },
      },
    });
    if (!hotel) throw new AppError(404, "Hotel not found");
    return hotel;
  },

  async createHotel(dto: CreateHotelDto) {
    const existing = await adminPrisma.hotel.findFirst({ where: { subdomain: dto.subdomain } });
    if (existing) throw new AppError(409, "Subdomain already taken");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const ownerRole = await adminPrisma.role.findFirst({ where: { name: "OWNER", hotelId: null } });
    if (!ownerRole) throw new AppError(500, "OWNER role not found — run the seed script");

    const result = await adminPrisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.create({
        data: {
          name: dto.hotelName,
          slug: dto.subdomain,
          subdomain: dto.subdomain,
          city: dto.city,
          propertyType: dto.propertyType,
          isActive: true,
          onboardingCompleted: false,
        },
      });

      const user = await tx.user.create({
        data: {
          name: dto.ownerName,
          email: dto.ownerEmail,
          passwordHash,
          tempPassword,
          isFirstLogin: true,
          isSuperAdmin: false,
        },
      });

      await tx.hotelUser.create({
        data: {
          hotelId: hotel.id,
          userId: user.id,
          role: "OWNER",
          roleId: ownerRole.id,
          isActive: true,
          acceptedAt: new Date(),
        },
      });

      return { hotel, user };
    });

    return {
      hotel: { id: result.hotel.id, name: result.hotel.name, subdomain: result.hotel.subdomain, slug: result.hotel.slug },
      owner: { name: result.user.name, email: result.user.email, tempPassword },
    };
  },

  async updateHotel(id: string, dto: UpdateHotelDto) {
    const hotel = await adminPrisma.hotel.findUnique({ where: { id } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    return adminPrisma.hotel.update({
      where: { id },
      data: { isActive: dto.isActive },
    });
  },

  async resetOwnerPassword(hotelId: string) {
    const hotel = await adminPrisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    const ownerHotelUser = await adminPrisma.hotelUser.findFirst({
      where: { hotelId, role: "OWNER" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!ownerHotelUser) throw new AppError(404, "Owner account not found for this hotel");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await adminPrisma.user.update({
      where: { id: ownerHotelUser.user.id },
      data: { passwordHash, tempPassword },
    });

    return {
      owner: { name: ownerHotelUser.user.name, email: ownerHotelUser.user.email, tempPassword },
    };
  },
};
