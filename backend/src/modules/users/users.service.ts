import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Address } from './entities/address.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Address) private addressRepo: Repository<Address>,
  ) {}

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['addresses'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const allowed = ['name', 'email', 'avatarUrl', 'fcmToken'];
    const filtered = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowed.includes(k)),
    );
    await this.userRepo.update(userId, filtered);
    return this.getProfile(userId);
  }

  async addAddress(userId: string, address: Partial<Address>): Promise<Address> {
    if (address.isDefault) {
      await this.addressRepo.update({ userId }, { isDefault: false });
    }
    const newAddress = this.addressRepo.create({ ...address, userId });
    return this.addressRepo.save(newAddress);
  }

  async updateAddress(userId: string, addressId: string, updates: Partial<Address>): Promise<Address> {
    const address = await this.addressRepo.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    if (updates.isDefault) {
      await this.addressRepo.update({ userId }, { isDefault: false });
    }
    await this.addressRepo.update(addressId, updates);
    return this.addressRepo.findOne({ where: { id: addressId } });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.addressRepo.findOne({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');
    await this.addressRepo.delete(addressId);
  }
}
