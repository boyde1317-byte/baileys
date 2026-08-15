/**
 * Tests for native flow button generation.
 *
 * Tests that confirmed working button types produce valid protobuf
 * structures, and that the raw passthrough (name + paramsJson) works
 * for any button type.
 */
import { describe, it, expect } from 'vitest';
import { proto } from '../../WAProto/index.js';

const NativeFlowMessage = proto.Message.InteractiveMessage.NativeFlowMessage;
const NativeFlowButton = proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton;

describe('Native flow button types', () => {
  it('creates a quick_reply button proto', () => {
    const params = { display_text: 'Reply', id: 'r1' };
    const button = NativeFlowButton.create({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('quick_reply');
    expect(JSON.parse(decoded.buttonParamsJson)).toEqual(params);
  });

  it('creates a cta_url button proto', () => {
    const params = { display_text: 'Open', url: 'https://example.com' };
    const button = NativeFlowButton.create({
      name: 'cta_url',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('cta_url');
    expect(JSON.parse(decoded.buttonParamsJson).url).toBe('https://example.com');
  });

  it('creates a cta_copy button proto', () => {
    const params = { display_text: 'Copy', copy_code: 'ABC-123' };
    const button = NativeFlowButton.create({
      name: 'cta_copy',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('cta_copy');
    expect(JSON.parse(decoded.buttonParamsJson).copy_code).toBe('ABC-123');
  });

  it('creates a cta_call button proto', () => {
    const params = { display_text: 'Call', phone_number: '+1234567890' };
    const button = NativeFlowButton.create({
      name: 'cta_call',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('cta_call');
    expect(JSON.parse(decoded.buttonParamsJson).phone_number).toBe('+1234567890');
  });

  it('creates a single_select button proto with sections', () => {
    const params = {
      title: 'Pick',
      sections: [{ title: 'S1', rows: [{ id: 'o1', title: 'Opt1' }] }]
    };
    const button = NativeFlowButton.create({
      name: 'single_select',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('single_select');
    expect(JSON.parse(decoded.buttonParamsJson).sections).toHaveLength(1);
  });

  it('creates a flow button proto', () => {
    const params = { display_text: 'Open', flow_token: 'tok123', flow_id: 'flow1' };
    const button = NativeFlowButton.create({
      name: 'flow',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('flow');
    expect(JSON.parse(decoded.buttonParamsJson).flow_token).toBe('tok123');
  });

  it('creates a cta_request_location button proto', () => {
    const params = { display_text: 'Share Location' };
    const button = NativeFlowButton.create({
      name: 'cta_request_location',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('cta_request_location');
  });

  it('creates a cta_request_phone button proto', () => {
    const params = { display_text: 'Share Phone' };
    const button = NativeFlowButton.create({
      name: 'cta_request_phone',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('cta_request_phone');
  });

  it('creates a send_location button proto', () => {
    const params = { display_text: 'Send Location' };
    const button = NativeFlowButton.create({
      name: 'send_location',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('send_location');
  });

  it('raw passthrough works for arbitrary button names', () => {
    const params = { display_text: 'Custom' };
    const button = NativeFlowButton.create({
      name: 'future_button_type',
      buttonParamsJson: JSON.stringify(params)
    });
    const encoded = NativeFlowButton.encode(button).finish();
    const decoded = NativeFlowButton.decode(encoded);
    expect(decoded.name).toBe('future_button_type');
    expect(JSON.parse(decoded.buttonParamsJson).display_text).toBe('Custom');
  });

  it('multiple buttons encode in a single NativeFlowMessage', () => {
    const buttons = [
      NativeFlowButton.create({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: 'Yes', id: 'yes' })
      }),
      NativeFlowButton.create({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: 'No', id: 'no' })
      }),
      NativeFlowButton.create({
        name: 'cta_url',
        buttonParamsJson: JSON.stringify({ display_text: 'Link', url: 'https://example.com' })
      })
    ];

    const flowMsg = NativeFlowMessage.create({ buttons });
    const encoded = NativeFlowMessage.encode(flowMsg).finish();
    const decoded = NativeFlowMessage.decode(encoded);

    expect(decoded.buttons).toHaveLength(3);
    expect(decoded.buttons[0].name).toBe('quick_reply');
    expect(decoded.buttons[2].name).toBe('cta_url');
  });
});

/**
 * Confirmed working native flow button types (per community sources + testing):
 *   quick_reply, single_select, cta_url, cta_copy, cta_call,
 *   cta_request_location, cta_request_phone, send_location, flow
 *
 * Removed types (WhatsApp silently ignores — never rendered):
 *   cta_address, cta_sign_in, cta_sign_contract, cta_complete_payment,
 *   cta_review_and_pay, cta_sign_up, cta_reminder, cta_open_chat,
 *   cta_schedule, cta_copy_address, cta_amazon_link, cta_delete_message,
 *   cta_payment, cta_payment_verification, cta_subscribe, target
 */
