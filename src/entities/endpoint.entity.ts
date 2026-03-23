import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { CheckStatus } from '../common/enums';
import { User } from './user.entity';
import { Alert } from './alert.entity';

@Entity('endpoints')
export class Endpoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column()
  name: string;

  @Column({ default: 60 })
  checkInterval: number;

  @Column({ default: false })
  isPaused: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastCheckedAt: Date;

  @Column({ type: 'enum', enum: CheckStatus, default: CheckStatus.UNKNOWN })
  lastStatus: CheckStatus;

  @Column({ type: 'float', default: 100 })
  uptimePercent: number;

  @ManyToOne(() => User, (user) => user.endpoints, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: string;

  @OneToMany(() => Alert, (alert) => alert.endpoint)
  alerts: Alert[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
