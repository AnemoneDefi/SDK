import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { CreateMarket } from "./application/use-cases/admin/CreateMarket";
import { InitializeProtocol } from "./application/use-cases/admin/InitializeProtocol";
import { DepositToKamino } from "./application/use-cases/keeper/DepositToKamino";
import { UpdateRateIndex } from "./application/use-cases/keeper/UpdateRateIndex";
import { WithdrawFromKamino } from "./application/use-cases/keeper/WithdrawFromKamino";
import { DepositLiquidity } from "./application/use-cases/lp/DepositLiquidity";
import { RequestWithdrawal } from "./application/use-cases/lp/RequestWithdrawal";
import {
  AnchorWallet,
  buildAnemoneProgram,
  buildReadonlyProgram,
} from "./infrastructure/anchor/AnemoneProgram";
import { MarketRepository } from "./infrastructure/repositories/MarketRepository";
import { PositionRepository } from "./infrastructure/repositories/PositionRepository";
import { ProtocolRepository } from "./infrastructure/repositories/ProtocolRepository";

export interface AnemoneConfig {
  connection: Connection;
  /** Required to send transactions. Omit for read-only usage. */
  wallet?: AnchorWallet;
}

export class Anemone {
  private readonly program: Program;

  /** Read-only queries: protocol, markets, positions */
  readonly query: AnemoneQuery;

  /** Admin instructions: initialize protocol, create market */
  readonly admin: AnemoneAdmin;

  /** LP instructions: deposit liquidity, request withdrawal */
  readonly lp: AnenoneLp;

  /** Keeper instructions: update rate index, deposit/withdraw from Kamino */
  readonly keeper: AnemoneKeeper;

  constructor(config: AnemoneConfig) {
    this.program = config.wallet
      ? buildAnemoneProgram(config.connection, config.wallet)
      : buildReadonlyProgram(config.connection);

    this.query = new AnemoneQuery(this.program);
    this.admin = new AnemoneAdmin(this.program);
    this.lp = new AnenoneLp(this.program);
    this.keeper = new AnemoneKeeper(this.program);
  }
}

class AnemoneQuery {
  readonly protocol: ProtocolRepository;
  readonly markets: MarketRepository;
  readonly positions: PositionRepository;

  constructor(program: Program) {
    this.protocol = new ProtocolRepository(program);
    this.markets = new MarketRepository(program);
    this.positions = new PositionRepository(program);
  }
}

class AnemoneAdmin {
  readonly initializeProtocol: InitializeProtocol;
  readonly createMarket: CreateMarket;

  constructor(program: Program) {
    this.initializeProtocol = new InitializeProtocol(program);
    this.createMarket = new CreateMarket(program);
  }
}

class AnenoneLp {
  readonly depositLiquidity: DepositLiquidity;
  readonly requestWithdrawal: RequestWithdrawal;

  constructor(program: Program) {
    this.depositLiquidity = new DepositLiquidity(program);
    this.requestWithdrawal = new RequestWithdrawal(program);
  }
}

class AnemoneKeeper {
  readonly updateRateIndex: UpdateRateIndex;
  readonly depositToKamino: DepositToKamino;
  readonly withdrawFromKamino: WithdrawFromKamino;

  constructor(program: Program) {
    this.updateRateIndex = new UpdateRateIndex(program);
    this.depositToKamino = new DepositToKamino(program);
    this.withdrawFromKamino = new WithdrawFromKamino(program);
  }
}
