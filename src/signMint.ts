import { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { scroll } from 'viem/chains';
import { SPHERE_QUIZ_NFT_ADDRESS } from './config';

const SIGNER_PRIVATE_KEY = (process.env.SIGNER_PRIVATE_KEY ?? '0x00') as Hex;
const account = privateKeyToAccount(SIGNER_PRIVATE_KEY);

const domain = {
  name: 'SPHERE-QUIZ NFT MINT',
  version: '1',
  chainId: scroll.id,
  verifyingContract: SPHERE_QUIZ_NFT_ADDRESS,
} as const;

export const types = {
  Mint: [
    { name: 'to', type: 'address' },
    { name: 'score', type: 'uint256' },
  ],
} as const;

interface MintData {
  to: Hex;
  score: number;
}

async function signMintData(mintData: MintData): Promise<Hex> {
  return account.signTypedData({
    domain,
    types,
    primaryType: 'Mint',
    message: {
      to: mintData.to,
      score: BigInt(mintData.score),
    },
  });
}

export default signMintData;
