import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Plan } from '../common/enums';
import { Endpoint } from './endpoint.entity';
import { Alert } from './alert.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  telegramChatId: string;

  @Column({ nullable: true })
  stripeCustomerId: string;

  @Column({ type: 'enum', enum: Plan, default: Plan.FREE })
  plan: Plan;

  @OneToMany(() => Endpoint, (endpoint) => endpoint.user)
  endpoints: Endpoint[];

  @OneToMany(() => Alert, (alert) => alert.user)
  alerts: Alert[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
