const pool = require('../config/database');

/**
 * Generate a document number atomically using MySQL advisory locks.
 * The lock ensures two concurrent requests cannot grab the same sequence number.
 *
 * Format examples:
 *   Invoice:          D260401
 *   Proposal:         P260401
 *   Design Document:  DD260401
 *   Service Agreement: S260401
 *
 * Structure: <prefix><YY><MM><seq2>
 */
async function generateNumber(type, prefix, year, month) {
  const lockName = `numbering_${type}_${year}_${month}`;
  const conn = await pool.getConnection();

  try {
    // Acquire advisory lock (timeout 5 seconds)
    const [[lockResult]] = await conn.execute(
      'SELECT GET_LOCK(?, 5) AS acquired',
      [lockName]
    );

    if (!lockResult.acquired) {
      throw new Error(`Could not acquire numbering lock for ${type}`);
    }

    try {
      const [[existing]] = await conn.execute(
        `SELECT sequence FROM numbering_sequences
         WHERE type = ? AND year = ? AND month = ?`,
        [type, year, month]
      );

      let sequence;
      if (!existing) {
        sequence = 1;
        await conn.execute(
          `INSERT INTO numbering_sequences (type, prefix, year, month, sequence, last_number)
           VALUES (?, ?, ?, ?, ?, NULL)`,
          [type, prefix, year, month, sequence]
        );
      } else {
        sequence = existing.sequence + 1;
        await conn.execute(
          `UPDATE numbering_sequences
           SET sequence = ?
           WHERE type = ? AND year = ? AND month = ?`,
          [sequence, type, year, month]
        );
      }

      const number = `${prefix}${year.toString().padStart(2, '0')}${month.toString().padStart(2, '0')}${sequence.toString().padStart(2, '0')}`;

      await conn.execute(
        `UPDATE numbering_sequences
         SET last_number = ?
         WHERE type = ? AND year = ? AND month = ?`,
        [number, type, year, month]
      );

      return number;
    } finally {
      // Always release the lock
      await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  } finally {
    conn.release();
  }
}

async function generateInvoiceNumber() {
  const now = new Date();
  return generateNumber('invoice', 'D', now.getFullYear() % 100, now.getMonth() + 1);
}

async function generateProposalNumber() {
  const now = new Date();
  return generateNumber('proposal', 'P', now.getFullYear() % 100, now.getMonth() + 1);
}

async function generateDesignDocumentNumber() {
  const now = new Date();
  return generateNumber('design_document', 'DD', now.getFullYear() % 100, now.getMonth() + 1);
}

async function generateServiceAgreementNumber() {
  const now = new Date();
  return generateNumber('service_agreement', 'S', now.getFullYear() % 100, now.getMonth() + 1);
}

module.exports = {
  generateInvoiceNumber,
  generateProposalNumber,
  generateDesignDocumentNumber,
  generateServiceAgreementNumber,
};
