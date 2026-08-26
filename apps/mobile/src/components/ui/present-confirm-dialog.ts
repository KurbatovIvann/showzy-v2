import { Alert } from "react-native";

import {
  confirmDialogAlertButtons,
  type ConfirmDialogChoice,
  type ConfirmDialogRequest,
} from "./confirm-dialog";

export function presentConfirmDialog(
  request: ConfirmDialogRequest,
): Promise<ConfirmDialogChoice> {
  return new Promise((resolve) => {
    let settled = false;
    const choose = (choice: ConfirmDialogChoice) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(choice);
    };
    const buttons = confirmDialogAlertButtons(request);
    Alert.alert(
      request.title,
      request.message,
      [
        {
          text: buttons.cancel.text,
          style: buttons.cancel.style,
          onPress: () => {
            choose("cancel");
          },
        },
        {
          text: buttons.confirm.text,
          style: buttons.confirm.style,
          onPress: () => {
            choose("confirm");
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          choose("cancel");
        },
      },
    );
  });
}
