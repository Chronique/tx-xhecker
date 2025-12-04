import { METADATA } from "../../../lib/utils";

export async function GET() {
  const config = {
    accountAssociation: {
      header: "eyJmaWQiOjM0NTk5MywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDk2Q2MxN0M3N2E1MDREM0ZERDUxNmU2NjIxMzAzMDdFZjc0M2QzMEIifQ",
      payload: "eyJkb21haW4iOiJ0eC14aGVja2VyLnZlcmNlbC5hcHAifQ",
      signature: "tS8gI7CYq1qyGedEnUYik706OL4+fym+0FSElp3FuYhSxAvMjC4cnmMs9cPJQVQKs4tO3wR1Ke/NUNzGquzsVhw=",
    },
    frame: {
      version: "1",
      name: METADATA.name,
      iconUrl: METADATA.iconImageUrl,
      homeUrl: METADATA.homeUrl,
      imageUrl: METADATA.bannerImageUrl,
      splashImageUrl: METADATA.iconImageUrl,
      splashBackgroundColor: METADATA.splashBackgroundColor,
      description: METADATA.description,
      ogTitle: METADATA.name,
      ogDescription: METADATA.description,
      ogImageUrl: METADATA.bannerImageUrl,
      requiredCapabilities: [
        "actions.ready",
        "actions.signIn",
        "actions.openUrl",
        "actions.sendToken",
        "actions.viewToken",
        "actions.composeCast",
        "actions.viewProfile",
        "actions.setPrimaryButton",
        "actions.swapToken",
        "actions.close",
        "actions.viewCast",
        "wallet.getEthereumProvider"
      ],
      requiredChains: [
        "eip155:8453",
        "eip155:10"
      ],
      canonicalDomain: "tx-xhecker.vercel.app", 
      noindex: false,
      tags: ["base", "tools"]
    },
    // PERBAIKAN: Cukup pilih satu saja, "utility" paling pas
    primaryCategory: "utility", 
    baseBuilder: {
      allowedAddresses: ["0x4fba95e4772be6d37a0c931D00570Fe2c9675524"],
    }
  };

  return Response.json(config);
}